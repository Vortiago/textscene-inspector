/**
 * The draw-sequence room a ScrollContainer holds after its subtree: one value for each
 * `INTERNAL_MODE_BACK` child it draws itself, two scroll hints and two bars
 * (`scroll_container.cpp:905-924`), so a y-sort can place each apart (`internalBackPieces.ts`).
 */

import type { PaintRoom } from '../../../../r3f/canvasItemPass/paintRoom';

export const scrollContainerPaintRoom: PaintRoom = { backRoom: () => 4 };
