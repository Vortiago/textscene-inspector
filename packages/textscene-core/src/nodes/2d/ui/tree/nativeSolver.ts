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
import type { NativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { ControlColor } from '../control/types';

/** `style_normal_color` (`default_theme.cpp:100`): Tree's `panel` fill (`:860`). */
const TREE_PANEL_FILL: ControlColor = { r: 0.1, g: 0.1, b: 0.1, a: 0.6 };

const DEFAULT_BORDER_COLOR: ControlColor = { r: 0.8, g: 0.8, b: 0.8, a: 1 };
const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };

/**
 * `default_theme.cpp:860`: `make_flat_stylebox(style_normal_color, 4, 4, 4, 5)`, whose bottom
 * margin (5) differs from `default_margin` (4). `NativeTheme` has no raw `scale` for
 * `Math.round(5 * scale)`, so the bottom is `Math.round(theme.contentMargin * 1.25)`, which is 5
 * at the default scale.
 */
export function treePanelStyleBox(theme: NativeTheme): StyleBoxFlatData {
  const m = theme.contentMargin;
  return {
    bgColor: TREE_PANEL_FILL,
    borderColor: DEFAULT_BORDER_COLOR,
    borderWidth: ZERO_SIDES,
    cornerRadius: {
      topLeft: theme.cornerRadius,
      topRight: theme.cornerRadius,
      bottomRight: theme.cornerRadius,
      bottomLeft: theme.cornerRadius,
    },
    expandMargin: ZERO_SIDES,
    contentMargin: { left: m, top: m, right: m, bottom: Math.round(m * 1.25) },
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
  };
}

/** `overrides['panel']` wins over `treePanelStyleBox`'s default. */
export function pickTreePanelStyleBox(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  theme: NativeTheme
): StyleBoxFlatData {
  return overrides.panel ?? treePanelStyleBox(theme);
}

/**
 * `overrides['title_button_normal']` wins over `theme.widgets.button.pressed`:
 * `make_flat_stylebox(style_pressed_color, 4, 4, 4, 4)` (`default_theme.cpp:873`) has the same
 * arguments as Button's pressed box (`:138-141`), so the two are equal, although separate `Ref`s.
 */
export function pickTreeTitleButtonStyleBox(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  theme: NativeTheme
): StyleBoxFlatData {
  return overrides.title_button_normal ?? theme.widgets.button.pressed;
}

/**
 * `Tree::_get_title_button_height` (`tree.cpp:4616-4624`) for a blank title, since none is
 * serialised: `title_button->get_minimum_size().height`, the same for every column.
 */
export function treeTitleButtonHeightPx(columnTitlesVisible: boolean | undefined, titleButtonBox: StyleBoxFlatData): number {
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
