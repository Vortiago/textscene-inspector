/**
 * TileMap's Y-sort and Z-index configuration warnings, a port of
 * `TileMap::get_configuration_warnings()` (tile_map.cpp:840-899). The isometric
 * check at tile_map.cpp:896 needs the TileSet's `tile_shape` value, which this
 * linter does not resolve, so it is out of scope.
 */

import type { Diagnostic } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { groundedArm, reportArm, type RuleArms } from '../../../../linter/ruleArms.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { boolSlotValue } from '../../../../godot/index.js';
import type { tileMapLayerVector } from '../shared/layerVector';

type Layer = ReturnType<typeof tileMapLayerVector>[number];

export const ySortArms = {
  ySortZIndexConflict: groundedArm('tilemap-y-sort-z-index-conflict', { kind: 'configuration-warning' }),
  layerYSortWithoutNode: groundedArm('tilemap-layer-y-sort-without-node', { kind: 'configuration-warning' }),
  nodeYSortWithoutLayer: groundedArm('tilemap-node-y-sort-without-layer', { kind: 'configuration-warning' }),
} as const satisfies RuleArms<string>;

export function ySortDiagnostics(
  node: TscnNode,
  rawProps: Record<string, string>,
  layers: readonly Layer[]
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  // A layer reads through the `layer_<i>/` group (tile_map.cpp:1028-1035). A layer with
  // neither key counts at its defaults, `y_sort_enabled` false and `z_index` 0, as the
  // engine's `Layer0` does before an author touches it.
  const isLayerYSorted = ([, leaves]: Layer) => boolSlotValue(leaves.get('y_sort_enabled')) === true;
  // `null` means no number this rule may name. It must not become 0, or an unreadable
  // z-index collides with a real 0 and reports a shared Z-index the file does not hold.
  const layerZIndex = ([, leaves]: Layer) => ruleInt(leaves.get('z_index'), 0);
  const nodeYSorted = boolSlotValue(rawProps.y_sort_enabled) === true; // inherited Node2D key, own node

  // tile_map.cpp:850-858, the `y_sorted_z_index.has(...)` scan.
  const ySortedZIndices = new Set(
    layers
      .filter(isLayerYSorted)
      .map(layerZIndex)
      .filter((z) => z !== null)
  );
  if (
    layers.some((layer) => {
      const z = layerZIndex(layer);
      return !isLayerYSorted(layer) && z !== null && ySortedZIndices.has(z);
    })
  ) {
    // :856
    reportArm(
      diagnostics,
      ySortArms.ySortZIndexConflict,
      node,
      `TileMap '${node.name}' has a Y-sorted layer sharing a Z-index with a non-Y-sorted layer. The non-Y-sorted layer will be Y-sorted as a whole alongside tiles from the Y-sorted layer.`
    );
  }

  // tile_map.cpp:860-882
  if (!nodeYSorted) {
    if (layers.some(isLayerYSorted)) {
      // :865
      reportArm(
        diagnostics,
        ySortArms.layerYSortWithoutNode,
        node,
        `TileMap '${node.name}' has a layer with y_sort_enabled, but y_sort_enabled is not set on the TileMap node itself.`
      );
    }
  } else if (!layers.some(isLayerYSorted)) {
    // :879
    reportArm(
      diagnostics,
      ySortArms.nodeYSortWithoutLayer,
      node,
      `TileMap '${node.name}' has y_sort_enabled set, but no layer has y_sort_enabled.`
    );
  }

  return diagnostics;
}
