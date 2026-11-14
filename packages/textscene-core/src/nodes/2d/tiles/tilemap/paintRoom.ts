/**
 * The draw-sequence room a TileMap holds: the whole run of each layer at the front, since each layer
 * is an internal child added with `INTERNAL_MODE_FRONT` (`tile_map.cpp:279`), and a reserve after
 * its children for its scene tiles.
 */

import type { TscnNode } from '../../../../parser/types';
import type { PaintRoom } from '../../../../r3f/canvasItemPass/paintRoom';
import { paintRangeSize } from '../../../../r3f/canvasPaintOrder';
import { tileMapLayerChildren } from '../../../../r3f/liveTileMapLayers';

export const tileMapPaintRoom: PaintRoom = {
  reservesTail: () => true,
  frontRoom: (node: TscnNode) =>
    tileMapLayerChildren(node).reduce((room, layer) => room + paintRangeSize(layer), 0),
};
