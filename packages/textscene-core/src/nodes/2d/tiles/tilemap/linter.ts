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
import { ySortDiagnostics } from './ySortRules.js';

function checkTileMap(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;

  const rawProps = node.properties as unknown as Record<string, string>;
  // The loaded vector, not the written keys: `get_configuration_warnings`
  // iterates the real `layers` (tile_map.cpp:848), which the constructor seeds
  // with a "Layer0" (:1014-1021) and `_set`'s grow loop fills up to the highest
  // index written (:701-710). A gap layer sits at TileMapLayer's own defaults —
  // not y-sorted, z_index 0 — and takes part in the comparison below.
  const layers = tileMapLayerVector(rawProps);
  // Keyed by the resolved index, so a layer the engine never builds carries no
  // tile data here either, and the key a message names is the one the loaded
  // layer answers to.
  const layerData: Array<[string, string]> = [];
  for (const [index, leaves] of layers) {
    const tileData = leaves.get('tile_data');
    if (tileData !== undefined) layerData.push([`layer_${index}/tile_data`, tileData]);
  }
  // tile_map.cpp:843 — unconditional; every TileMap node carries this, whatever
  // it's configured with.
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
      severity: 'warning',
      message: `TileMap has tile data but no 'tile_set' — its tiles cannot render.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'tilemap-requires-tileset',
    });
  }

  // Each layer decodes under the `format` in effect when ITS key is applied
  // (file order, tileDataSlots.ts). The decoder for the older formats is
  // compiled in, but the guard above it is not: tile_map.cpp:71 refuses
  // anything but the newest format whenever DISABLE_DEPRECATED is UNSET, which
  // is every stock build, so the layer's tile data is dropped whole.
  const refused: string[] = [];
  for (const [key, value] of layerData) {
    const format = formatWhenApplied(rawProps, key);
    if (format !== TILE_MAP_DATA_FORMAT_DEFAULT) {
      // Only a `format` ABOVE the key reaches here, so the raw literal is the one applied.
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
        severity: 'warning',
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
