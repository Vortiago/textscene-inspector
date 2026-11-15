/**
 * The draw-sequence room a TileMap holds: its layers at the front, since each layer is an internal
 * child added with `INTERNAL_MODE_FRONT` (`tile_map.cpp:279`), and a reserve after its children for
 * its scene tiles.
 */

import type { PaintRoom } from '../../../../r3f/canvasItemPass/paintRoom';
import { tileMapLayerChildren } from '../../../../r3f/liveTileMapLayers';

export const tileMapPaintRoom: PaintRoom = {
  reservesTail: () => true,
  frontChildren: tileMapLayerChildren,
};
