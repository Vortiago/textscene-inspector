/**
 * Tree's draw-time geometry: `_get_content_rect`, `_get_title_button_height` and `get_column_width`
 * (`scene/gui/tree.cpp`), for the always-empty case (`root` is null, `parser.ts`), so each column's
 * floor is its title button's chrome alone. Tree overrides no `get_minimum_size`, so it registers no
 * `MinimumSizeFn` and floors at Control's `(0, 0)`. `Component.tsx` paints from this geometry.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { contentMarginSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { Rect2 } from '../../../../godot/math/rect2';

/**
 * `Tree::_get_title_button_height` (`tree.cpp:4616-4624`) for a blank title, since none is
 * serialised: `title_button->get_minimum_size().height`, the same for every column.
 */
export function treeTitleButtonHeightPx(
  columnTitlesVisible: boolean | undefined,
  titleButtonBox: StyleBoxFlatData
): number {
  if (!columnTitlesVisible) return 0;
  return contentMarginSize(titleButtonBox).y;
}

/**
 * `Tree::_get_content_rect` (`tree.cpp:3750-3765`) for the always-empty case: no item reserves
 * scrollbar space, so this is the panel stylebox's content rect, unchanged.
 */
export function treeContentRect(rectSize: { x: number; y: number }, panelBox: StyleBoxFlatData): Rect2 {
  return {
    x: panelBox.contentMargin.left,
    y: panelBox.contentMargin.top,
    w: Math.max(0, rectSize.x - panelBox.contentMargin.left - panelBox.contentMargin.right),
    h: Math.max(0, rectSize.y - panelBox.contentMargin.top - panelBox.contentMargin.bottom),
  };
}

/**
 * `Tree::get_column_width` (`tree.cpp:5668-5687`) over `get_column_minimum_width` (`:5615-5654`):
 * with script-only `custom_min_width` and no `TreeItem`, each minimum is the title button's L+R
 * margin when titles show, else 0. Every column defaults to `expand_ratio = 1` (tree.h), so the
 * integer division gives one shared width, which the caller multiplies by column index.
 */
export function treeColumnWidthPx(
  contentRectWidthPx: number,
  columns: number,
  columnTitlesVisible: boolean | undefined,
  titleButtonBox: StyleBoxFlatData
): number {
  const minWidthPx = columnTitlesVisible ? contentMarginSize(titleButtonBox).x : 0;
  const expandAreaPx = contentRectWidthPx - columns * minWidthPx;
  if (expandAreaPx < columns) return minWidthPx;
  return minWidthPx + Math.trunc(expandAreaPx / columns);
}

/**
 * One header cell's x, `tree.cpp:5154-5160`: `ofs2` starts at the panel's
 * `SIDE_LEFT` margin and advances one column width per cell, then RTL mirrors
 * the rect inside the Tree's own width rather than its parent's.
 */
export function treeTitleButtonX(
  index: number,
  contentRectX: number,
  columnWidthPx: number,
  controlWidthPx: number,
  rtl: boolean
): number {
  const x = contentRectX + index * columnWidthPx;
  return rtl ? controlWidthPx - columnWidthPx - x : x;
}
