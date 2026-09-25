/**
 * Semantic linter rules for the legacy TileMap. Format validation lives in
 * linterParser.ts and tileDataSlots.ts; the Y-sort/Z-index configuration
 * warnings in ySortRules.ts. These rules use scene context and the shared
 * tile-data decoder, walking the dynamic `layer_N/...` property groups.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { resourceSlotIsEmpty } from '../../../../linter/resourceChecker.js';
import { decodeLegacyTileData } from '../shared/tileData.js';
import { TILE_MAP_DATA_FORMAT_DEFAULT, formatWhenApplied, tileDataValidator } from './tileDataSlots.js';
import { tileMapLayerVector } from '../shared/layerVector';
import { visitIndexedKeys } from '../../../../godot/index.js';
import { ySortDiagnostics } from './ySortRules.js';

/** One `layer_<i>/tile_data` write, the key as the file writes it. */
interface TileDataWrite {
  key: string;
  value: string;
  /** The layer `_set` resolves the key to (`property_list_helper.cpp:130-131`). */
  layer: number;
  /** The `format` in effect at the key's line (`tileDataSlots.ts`). */
  format: number;
}

/**
 * Every `layer_<i>/tile_data` write, in file order. Two spellings of one layer (`layer_1/…` and
 * `layer_+1/…`) are two writes, each read under the `format` in effect at its own line, because
 * Godot applies properties in file order. A layer the engine never builds carries none.
 */
function tileDataWrites(rawProps: Record<string, string>): TileDataWrite[] {
  const writes: TileDataWrite[] = [];
  visitIndexedKeys(rawProps, 'layer_', 'is_valid_int', (key, _indexText, layer, leaf, value) => {
    if (leaf !== 'tile_data') return;
    writes.push({ key, value, layer, format: formatWhenApplied(rawProps, key) });
  });
  return writes;
}

function checkTileMap(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  const rawProps = node.properties as unknown as Record<string, string>;
  // The loaded vector, not the written keys: `get_configuration_warnings`
  // iterates the real `layers` (tile_map.cpp:848), seeded with "Layer0"
  // (:1014-1021) and grown to the highest index written (:701-710). A gap layer
  // is not y-sorted, at z_index 0, and takes part in the comparison below.
  const layers = tileMapLayerVector(rawProps);
  // tile_map.cpp:843: unconditional, on every TileMap whatever its configuration.
  diagnostics.push({
    severity: 'warning',
    message: `TileMap '${node.name}' is deprecated, superseded by TileMapLayer nodes. Use the editor's "Extract TileMap layers as individual TileMapLayer nodes" action to convert it.`,
    nodeName: node.name,
    nodeType: node.type,
    ruleName: 'tilemap-deprecated',
  });

  diagnostics.push(...ySortDiagnostics(node, rawProps, layers));

  // The key whose tile data each layer holds after every write, in file order. A refused write
  // returns before `layers[p_layer]->clear()` (tile_map.cpp:81), so the layer keeps the data an
  // earlier write loaded.
  const loadedFrom = new Map<number, string>();
  const refused: string[] = [];
  for (const { key, value, layer, format } of tileDataWrites(rawProps)) {
    if (format !== TILE_MAP_DATA_FORMAT_DEFAULT) {
      // tile_map.cpp:71 refuses any but the newest format when DISABLE_DEPRECATED is unset, as
      // in every stock build. Only a `format` above the key reaches here, so the raw literal is
      // the one applied.
      const kept = loadedFrom.get(layer);
      const leaves = kept === undefined ? 'empty' : `with the tile data of '${kept}'`;
      refused.push(`'${key}' (format = ${rawProps.format}) leaves layer ${layer} ${leaves}`);
      continue;
    }
    // Phase 1 has already refused a malformed shape, so only a value it accepted is decoded.
    if (tileDataValidator(key, value, 0) !== null) continue;
    if (decodeLegacyTileData(value, format) === null) {
      diagnostics.push({
        severity: 'error',
        message: `'${key}' is not a decodable PackedInt32Array of cell triplets (${key.replace('/tile_data', '')}).`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'tilemap-invalid-tile-data',
      });
      continue;
    }
    loadedFrom.set(layer, key);
  }

  if (loadedFrom.size > 0 && resourceSlotIsEmpty(rawProps.tile_set)) {
    diagnostics.push({
      severity: 'info',
      message: `TileMap has tile data but no 'tile_set' — its tiles cannot render.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'tilemap-requires-tileset',
    });
  }

  if (refused.length > 0) {
    diagnostics.push({
      severity: 'error',
      message:
        `TileMap refuses Godot 3 tile data outright (tile_map.cpp:71): ${refused.join('; ')}.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'tilemap-unsupported-format',
    });
  }

  return diagnostics;
}

const tileMapValidationRule: LintRule = {
  meta: {
    name: 'valid-tilemap',
    description:
      'Validates TileMap tile_set assignment, data format, per-layer tile data, deprecation, and Y-sort/Z-index consistency',
    category: 'validation',
    applicableNodeTypes: ['TileMap'],
    emits: [
      { ruleName: 'tilemap-deprecated', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'tilemap-y-sort-z-index-conflict', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'tilemap-layer-y-sort-without-node', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'tilemap-node-y-sort-without-layer', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'tilemap-requires-tileset',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'tile_map_layer.cpp:224',
          unused: 'a null tile set forces the cleanup path, so nothing is drawn',
        },
      },
      {
        ruleName: 'tilemap-unsupported-format',
        severity: 'error',
        grounding: { kind: 'engine', at: 'tile_map.cpp:71' },
      },
      {
        ruleName: 'tilemap-invalid-tile-data',
        severity: 'error',
        grounding: { kind: 'engine', at: 'tile_map.cpp:79' },
      },
    ],
  },
  check: checkTileMap,
};

ruleRegistry.register(tileMapValidationRule);

export { tileMapValidationRule };
