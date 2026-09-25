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
import { indexedKeys } from '../../../../godot/index.js';
import { ySortDiagnostics } from './ySortRules.js';

/**
 * Each layer's `layer_<i>/tile_data` key and value, in layer order, the key as the file writes it.
 * Resolved as `_set` resolves it, so a layer the engine never builds carries no tile data here.
 * Of two spellings of one layer (`layer_1/…` and `layer_+1/…`) the later one wins, as Godot applies
 * properties in file order. Its own spelling is what `formatWhenApplied` finds in the file.
 */
function tileDataKeys(rawProps: Record<string, string>): Array<[string, string]> {
  const byLayer = new Map<number, [string, string]>();
  for (const { key, index, leaf, value } of indexedKeys(rawProps, 'layer_', 'is_valid_int')) {
    if (leaf === 'tile_data') byLayer.set(index, [key, value]);
  }
  return [...byLayer].sort(([a], [b]) => a - b).map(([, entry]) => entry);
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
  const layerData = tileDataKeys(rawProps);
  // tile_map.cpp:843: unconditional, on every TileMap whatever its configuration.
  diagnostics.push({
    severity: 'warning',
    message: `TileMap '${node.name}' is deprecated, superseded by TileMapLayer nodes. Use the editor's "Extract TileMap layers as individual TileMapLayer nodes" action to convert it.`,
    nodeName: node.name,
    nodeType: node.type,
    ruleName: 'tilemap-deprecated',
  });

  diagnostics.push(...ySortDiagnostics(node, rawProps, layers));

  if (layerData.length > 0 && resourceSlotIsEmpty(rawProps.tile_set)) {
    diagnostics.push({
      severity: 'info',
      message: `TileMap has tile data but no 'tile_set' — its tiles cannot render.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'tilemap-requires-tileset',
    });
  }

  // Each layer decodes under the `format` in effect when its key applies (file
  // order, tileDataSlots.ts). tile_map.cpp:71 refuses any but the newest format
  // when DISABLE_DEPRECATED is unset, as in every stock build, so the layer's
  // tile data drops whole.
  const refused: string[] = [];
  for (const [key, value] of layerData) {
    const format = formatWhenApplied(rawProps, key);
    if (format !== TILE_MAP_DATA_FORMAT_DEFAULT) {
      // Only a `format` above the key reaches here, so the raw literal is the one applied.
      refused.push(`'${key}' (format = ${rawProps.format})`);
    } else if (tileDataValidator(key, value, 0) === null && decodeLegacyTileData(value, format) === null) {
      // Phase 1 has already refused the shape; only a value it accepted can
      // still fail the triplet decode.
      diagnostics.push({
        severity: 'error',
        message: `'${key}' is not a decodable PackedInt32Array of cell triplets (${key.replace('/tile_data', '')}).`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'tilemap-invalid-tile-data',
      });
    }
  }
  if (refused.length > 0) {
    diagnostics.push({
      severity: 'error',
      message:
        `TileMap loads ${refused.join(', ')} under a Godot 3 tile data format. ` +
        `Godot refuses the tile data outright, so the layer loads empty.`,
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
