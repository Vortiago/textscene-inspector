/**
 * Semantic linter rules for the legacy TileMap. Format validation lives in
 * linterParser.ts; these rules use scene context and the shared tile-data
 * decoder, walking the dynamic `layer_N/...` property groups.
 *
 * Four of these mirror `TileMap::get_configuration_warnings()`
 * (tile_map.cpp:840-899):
 *
 *     warnings.push_back(RTR("The TileMap node is deprecated ..."));  // :843, unconditional
 *
 *     RBSet<int> y_sorted_z_index;
 *     for (layer : layers) if (layer->is_y_sort_enabled()) y_sorted_z_index.insert(layer->get_z_index());
 *     for (layer : layers) if (!layer->is_y_sort_enabled() && y_sorted_z_index.has(layer->get_z_index())) {
 *         warnings.push_back(...); break;                             // :856
 *     }
 *
 *     if (!is_y_sort_enabled()) {
 *         for (layer : layers) if (layer->is_y_sort_enabled()) { warnings.push_back(...); break; }   // :865
 *     } else {
 *         bool need_warning = true;
 *         for (layer : layers) if (layer->is_y_sort_enabled()) { need_warning = false; break; }
 *         if (need_warning) warnings.push_back(...);                  // :879
 *     }
 *
 * `layers` is read through the `layer_<i>/...` `PropertyListHelper` group
 * (tile_map.cpp:1028-1035): `y_sort_enabled` defaults false, `z_index` 0
 * (`TileMapLayer`'s own field defaults), so a layer with neither key present
 * still counts, at its defaults — exactly like the engine's constructor-created
 * `Layer0`, which starts with zero own keys until an author touches it.
 * `tile_map.cpp:896`'s isometric-without-Y-sort check needs the referenced
 * TileSet's `tile_shape` VALUE, resource content this linter does not resolve,
 * so it is out of scope here.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { checkResourceExists, resourceSlotIsEmpty } from '../../../../linter/resourceChecker.js';
import { decodeLegacyTileData } from '../shared/tileData.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { tileMapLayerVector } from '../shared/layerVector';
import { boolSlotValue } from '../../../../godot/index.js';

function checkTileMap(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

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
    const tileData = leaves.tile_data;
    if (tileData !== undefined) layerData.push([`layer_${index}/tile_data`, tileData]);
  }
  // Absent means the current format, not the oldest one: the member initialises
  // to TILE_MAP_DATA_FORMAT_3, which is 2 (tile_map.h:64). Defaulting to 0 read
  // an unversioned TileMap as Godot 3 data and reported a format the file never
  // claimed.
  const format = ruleInt(rawProps.format, 2);

  // tile_map.cpp:843 — unconditional; every TileMap node carries this, whatever
  // it's configured with.
  diagnostics.push({
    severity: 'warning',
    message: `TileMap '${node.name}' is deprecated, superseded by TileMapLayer nodes. Use the editor's "Extract TileMap layers as individual TileMapLayer nodes" action to convert it.`,
    nodeName: node.name,
    nodeType: node.type,
    ruleName: 'tilemap-deprecated',
  });

  type Layer = (typeof layers)[number];
  const isLayerYSorted = ([, leaves]: Layer) => boolSlotValue(leaves.y_sort_enabled) === true;
  const layerZIndex = ([, leaves]: Layer) => ruleInt(leaves.z_index, 0) || 0;
  const nodeYSorted = boolSlotValue(rawProps.y_sort_enabled) === true; // inherited Node2D key, own node

  // tile_map.cpp:850-858
  const ySortedZIndices = new Set(layers.filter(isLayerYSorted).map(layerZIndex));
  if (layers.some((layer) => !isLayerYSorted(layer) && ySortedZIndices.has(layerZIndex(layer)))) {
    diagnostics.push({
      severity: 'warning',
      message: `TileMap '${node.name}' has a Y-sorted layer sharing a Z-index with a non-Y-sorted layer. The non-Y-sorted layer will be Y-sorted as a whole alongside tiles from the Y-sorted layer.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'tilemap-y-sort-z-index-conflict',
    });
  }

  // tile_map.cpp:860-882
  if (!nodeYSorted) {
    if (layers.some(isLayerYSorted)) {
      diagnostics.push({
        severity: 'warning',
        message: `TileMap '${node.name}' has a layer with y_sort_enabled, but y_sort_enabled is not set on the TileMap node itself.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'tilemap-layer-y-sort-without-node',
      });
    }
  } else if (!layers.some(isLayerYSorted)) {
    diagnostics.push({
      severity: 'warning',
      message: `TileMap '${node.name}' has y_sort_enabled set, but no layer has y_sort_enabled.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'tilemap-node-y-sort-without-layer',
    });
  }

  if (layerData.length > 0 && resourceSlotIsEmpty(rawProps.tile_set)) {
    diagnostics.push({
      severity: 'warning',
      message: `TileMap has tile data but no 'tile_set' — its tiles cannot render.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'tilemap-requires-tileset',
    });
  }

  if (rawProps.tile_set && !checkResourceExists(scene, rawProps.tile_set)) {
    diagnostics.push({
      severity: 'error',
      message: `TileSet resource not found: ${rawProps.tile_set}`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'valid-tilemap-resources',
    });
  }

  // An unreadable `format` is its own validator's error, and a non-finite one is
  // altered at parse; with no version number there is nothing to say about the
  // tile data underneath it.
  if (format === null) return diagnostics;

  // The decoder for the older formats is compiled in, but the guard above it
  // is not: tile_map.cpp:71 refuses anything but the newest format whenever
  // DISABLE_DEPRECATED is UNSET, which is every stock build. So the layer's
  // tile data is dropped whole, rather than decoded through the legacy path.
  if (layerData.length > 0 && format !== 2) {
    diagnostics.push({
      severity: 'error',
      message:
        `TileMap 'format = ${format}' is a Godot 3 tile data format. ` +
        `Godot refuses the tile data outright, so the layer loads empty.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'tilemap-unsupported-format',
    });
  } else {
    for (const [key, value] of layerData) {
      if (decodeLegacyTileData(value, format) === null) {
        diagnostics.push({
          severity: 'error',
          message: `'${key}' is not a decodable PackedInt32Array of cell triplets (${key.replace('/tile_data', '')}).`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'tilemap-invalid-tile-data',
        });
      }
    }
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
        ruleName: 'valid-tilemap-resources',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the tile_set reference names a resource id this file never declares',
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
