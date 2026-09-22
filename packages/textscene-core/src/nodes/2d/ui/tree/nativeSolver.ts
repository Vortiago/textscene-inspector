/**
 * Tree's own draw-time geometry — `_get_content_rect`/`_get_title_button_height`/
 * `get_column_width` (`scene/gui/tree.cpp`), restricted to the ALWAYS-EMPTY
 * case this previewer draws (`root` is always null — `parser.ts`'s own doc):
 * no item ever contributes to a column's minimum width, so every column's
 * own floor is its title button's own chrome alone.
 *
 * Tree registers no `MinimumSizeFn`: `Tree::get_minimum_size` is never
 * overridden (no `Size2 Tree::get_minimum_size` in `tree.cpp`), so its own
 * contribution is Control's base `(0, 0)` — `solverRegistry.ts`'s own doc:
 * "a type with no registration is a leaf". `Component.tsx` needs geometry,
 * not a floor, so those functions live here anyway, just uncalled by the
 * solver registry.
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

/** `style_normal_color` (`default_theme.cpp:100`) — Tree's own `panel` fill (`:860`). */
const TREE_PANEL_FILL: ControlColor = { r: 0.1, g: 0.1, b: 0.1, a: 0.6 };

const DEFAULT_BORDER_COLOR: ControlColor = { r: 0.8, g: 0.8, b: 0.8, a: 1 };
const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };

/**
 * `default_theme.cpp:860`: `make_flat_stylebox(style_normal_color, 4, 4, 4, 5)`
 * — the ONE default-theme box in this codebase whose bottom margin (5) is a
 * DIFFERENT literal from its other three sides (4, `default_margin`), so it
 * cannot reuse `theme.contentMargin` (already `Math.round(4 * scale)`) on
 * that side. `NativeTheme` carries no raw `scale` to build `Math.round(5 *
 * scale)` independently (`nativeTheme.ts` never re-exports it) — the bottom
 * margin below is instead `Math.round(theme.contentMargin * 1.25)`, exact at
 * every scale this codebase's own rounding produces no half-pixel drift at
 * (verified at the default scale, 1, where `contentMargin` is exactly 4 and
 * `4 * 1.25 = 5`).
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

/** `overrides['panel']` wins; otherwise `treePanelStyleBox`'s default above. */
export function pickTreePanelStyleBox(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  theme: NativeTheme
): StyleBoxFlatData {
  return overrides.panel ?? treePanelStyleBox(theme);
}

/**
 * `overrides['title_button_normal']` wins; otherwise `theme.widgets.button.pressed`
 * — `default_theme.cpp:873`: `make_flat_stylebox(style_pressed_color, 4, 4,
 * 4, 4)`, the SAME fill colour and every DEFAULT margin/radius arg Button's
 * own "pressed" box is built from (`:138-141`), so the two are numerically
 * identical structs even though Godot constructs them as separate `Ref`s.
 */
export function pickTreeTitleButtonStyleBox(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  theme: NativeTheme
): StyleBoxFlatData {
  return overrides.title_button_normal ?? theme.widgets.button.pressed;
}

/**
 * `Tree::_get_title_button_height` (`tree.cpp:4616-4624`), restricted to a
 * BLANK title (`columns[i].text_buf->get_size().y` is always 0 — no title is
 * ever serialised): `h = title_button->get_minimum_size().height` for every
 * column, so the max across columns collapses to that one shared number.
 */
export function treeTitleButtonHeightPx(columnTitlesVisible: boolean | undefined, titleButtonBox: StyleBoxFlatData): number {
  if (!columnTitlesVisible) return 0;
  return contentMarginSize(titleButtonBox).y;
}

/**
 * `Tree::_get_content_rect` (`tree.cpp:3750-3765`), restricted to the
 * always-empty case: no item ever exists to reserve scrollbar space (`root`
 * is always null), so the scrollbar-narrowing tail of the real function
 * never fires and this is the panel stylebox's own content rect, unchanged.
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
 * `Tree::get_column_width` (`tree.cpp:5668-5687`) composed with
 * `get_column_minimum_width` (`:5615-5654`), restricted to the always-empty
 * case: `custom_min_width` is never serialised (stays its own default `0`,
 * `set_column_custom_minimum_width` is script-only) and no `TreeItem` exists
 * to widen a column, so each column's own minimum is EXACTLY its title
 * button's own L+R content margin when titles are visible, else `0` — the
 * SAME number for every column, since every title is equally blank. Every
 * column defaults `expand = true`, `expand_ratio = 1`
 * (`tree.h`'s `Column` struct), so `expanding_total === columns.length` and
 * the C++ integer division `expand_area * ratio / expanding_total` is
 * IDENTICAL for every column — this returns that one shared width rather
 * than an array, and the caller multiplies by column index for x-offset.
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
 * One header cell's own x, `tree.cpp:5154-5160`: `ofs2` starts at the panel's
 * `SIDE_LEFT` margin and advances one column width per cell, then RTL mirrors
 * the rect inside the Tree's OWN width rather than its parent's.
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
