/**
 * TileMap's Y-sort/Z-index configuration warnings, mirroring
 * `TileMap::get_configuration_warnings()` (tile_map.cpp:840-899):
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

import type { Diagnostic } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { boolSlotValue } from '../../../../godot/index.js';
import type { tileMapLayerVector } from '../shared/layerVector';

type Layer = ReturnType<typeof tileMapLayerVector>[number];

export function ySortDiagnostics(
  node: TscnNode,
  rawProps: Record<string, string>,
  layers: readonly Layer[]
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const at = { nodeName: node.name, nodeType: node.type };
  const isLayerYSorted = ([, leaves]: Layer) => boolSlotValue(leaves.get('y_sort_enabled')) === true;
  // `ruleInt`'s `null` means "no number this rule may name" and must not become
  // 0: `|| 0` made an unreadable z-index collide with a genuine 0 and reported a
  // shared Z-index that is in neither the file nor the engine.
  const layerZIndex = ([, leaves]: Layer) => ruleInt(leaves.get('z_index'), 0);
  const nodeYSorted = boolSlotValue(rawProps.y_sort_enabled) === true; // inherited Node2D key, own node

  // tile_map.cpp:850-858
  const ySortedZIndices = new Set(
    layers.filter(isLayerYSorted).map(layerZIndex).filter((z) => z !== null)
  );
  if (
    layers.some((layer) => {
      const z = layerZIndex(layer);
      return !isLayerYSorted(layer) && z !== null && ySortedZIndices.has(z);
    })
  ) {
    diagnostics.push({
      severity: 'warning',
      message: `TileMap '${node.name}' has a Y-sorted layer sharing a Z-index with a non-Y-sorted layer. The non-Y-sorted layer will be Y-sorted as a whole alongside tiles from the Y-sorted layer.`,
      ...at,
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
      ...at,
      ruleName: 'tilemap-node-y-sort-without-layer',
    });
  }

  return diagnostics;
}
