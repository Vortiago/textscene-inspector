/**
 * The draw-sequence room a TileMapLayer holds after its children: a y-sort splits it into one group
 * per tile row once its tileset loads, and it instantiates its scene tiles after its children.
 */

import type { PaintRoom } from '../../../../r3f/canvasItemPass/paintRoom';

export const tileMapLayerPaintRoom: PaintRoom = { reservesTail: () => true };
