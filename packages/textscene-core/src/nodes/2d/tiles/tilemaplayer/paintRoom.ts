/**
 * The draw-sequence room a TileMapLayer holds after its children: a y-sort splits it into one group
 * per tile row once its tileset loads, and it instantiates its scene tiles after its children.
 */

import type { TscnNode } from '../../../../parser/types';
import type { PaintRoom } from '../../../../r3f/canvasItemPass/paintRoom';
import type { TileMapLayerProperties } from './types';

export const tileMapLayerPaintRoom: PaintRoom = { reservesTail: drawsAfterChildren };

/** A TileMap's layer leaves its scene tiles to the TileMap (`tile_map_layer.cpp:1646`), so only its rows need room. */
function drawsAfterChildren(node: TscnNode): boolean {
  const { drawsSceneTiles, y_sort_enabled: ySorted } = node.properties as Partial<TileMapLayerProperties>;
  return drawsSceneTiles !== false || ySorted === true;
}
