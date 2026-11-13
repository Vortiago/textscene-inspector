/**
 * The children a TileMap adds for its layers, as the live tree holds them. Godot makes each layer a
 * TileMapLayer and adds it as an internal front child (`tile_map.cpp:277-279`, `:703-705`), so every
 * pass over the tree covers the layers before the authored children. Pure, no React.
 */

import type { TscnNode } from '../parser/types.js';
import type { LiveNode } from '../resources/liveNode.js';
import type { TileMapProperties } from '../nodes/2d/tiles/tilemap/types.js';
import type { TileMapLayerProperties } from '../nodes/2d/tiles/tilemaplayer/types.js';
import { childCanvasItemProperties } from '../nodes/2d/tiles/shared/childCanvasItem.js';
import { perObject } from '../utils/perObject.js';

/**
 * The layer children of `node`, or null for a node that is no TileMap. A layer is named
 * `@TileMapLayer@<index>`, as Godot names a generated node, so no authored child shares its path. It
 * leaves the scene tiles to the TileMap, which holds the instances of every layer (`tile_map_layer.cpp:1646`).
 */
export function tileMapLayerChildren(node: TscnNode): readonly LiveNode[] | null {
  return node.type === 'TileMap' ? layerNodesOf(node) : null;
}

/** By node, so a step built again hands back the same layer nodes. */
const layerNodesOf = perObject((map: TscnNode): readonly LiveNode[] => {
  const { layers = [], ...props } = map.properties as TileMapProperties;
  return layers.map((layer, index): LiveNode => ({
    name: `@TileMapLayer@${index}`,
    type: 'TileMapLayer',
    parent: '.',
    properties: {
      ...childCanvasItemProperties(props),
      tile_set: props.tile_set,
      enabled: layer.enabled,
      rendering_quadrant_size: props.rendering_quadrant_size,
      cells: layer.cells,
      drawsSceneTiles: false,
      y_sort_enabled: layer.ySortEnabled,
      y_sort_origin: layer.ySortOrigin,
      z_index: layer.zIndex,
      ...(layer.modulate && { modulate: layer.modulate }),
    } satisfies TileMapLayerProperties,
    rawProperties: {},
    children: [],
    isUnowned: true,
  }));
});
