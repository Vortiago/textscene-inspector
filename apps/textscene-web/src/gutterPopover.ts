/**
 * Where a gutter row's popover opens, and how tall it may grow. `.sourceBody` clips it at the
 * pane's edges, so it opens toward the larger side of the row and scrolls past that side's room.
 */

/** A row's top and bottom edge, and the visible gutter's height, in pixels from its top edge. */
export interface GutterGeometry {
  rowTop: number;
  rowBottom: number;
  viewportHeight: number;
}

/** Which way the popover opens from its row, and its height cap in pixels. */
export interface PopoverPlacement {
  opensUp: boolean;
  maxHeight: number;
}

/** Pixels kept free between the popover and the pane's edge, so its border and shadow show. */
export const POPOVER_EDGE_MARGIN = 4;

/**
 * Upward from the bottom edge of a row in the lower half of the visible gutter, and downward
 * from the top edge of any other row. The cap is the room on that side, and never less than the
 * row itself. `null` where the gutter has no height, which is no layout: the CSS default stands.
 */
export function placeGutterPopover({
  rowTop,
  rowBottom,
  viewportHeight,
}: GutterGeometry): PopoverPlacement | null {
  if (!(viewportHeight > 0)) return null;
  const opensUp = (rowTop + rowBottom) / 2 > viewportHeight / 2;
  const room = opensUp ? rowBottom : viewportHeight - rowTop;
  return { opensUp, maxHeight: Math.max(rowBottom - rowTop, room - POPOVER_EDGE_MARGIN) };
}
