/**
 * The draw-sequence room every Control holds after its subtree: one value for its chrome, such as
 * a ScrollContainer's bars, each added with `INTERNAL_MODE_BACK` (`scroll_container.cpp:919,924`).
 */

import type { PaintRoom } from '../../../../r3f/canvasItemPass/paintRoom';

export const controlPaintRoom: PaintRoom = { backRoom: () => 1 };
