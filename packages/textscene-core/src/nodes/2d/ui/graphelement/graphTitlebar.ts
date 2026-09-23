/**
 * The titlebar band GraphNode and GraphFrame build from an internal
 * `HBoxContainer` (`titlebar_hbox`) that holds one internal `Label`
 * (`title_label`, type variation `GraphNodeTitleLabel`/`GraphFrameTitleLabel`):
 * `graph_node.cpp:1322-1334`, `graph_frame.cpp:348-360`. Both are
 * `INTERNAL_MODE_FRONT` children and never serialised, so the owning node's
 * `title` is the only `.tscn` input.
 *
 * `titlebar_hbox` is `SIZE_EXPAND_FILL` wide, FILL tall, and its minimum size is
 * `title_label`'s. `_resort` hands `fit_child_in_rect` a height already reduced
 * by `sb_titlebar`'s margins, so `Control::set_rect`'s minimum-size floor
 * (`control.cpp:1773-1797`) raises it back to the text's minimum height.
 * `controlRectSolver.ts` cannot apply that floor, since `titlebar_hbox` is no
 * `SolveNode`, so this module computes the converged height in closed form,
 * independent of the margins. It matches `titlebar_rect` in `NOTIFICATION_DRAW`
 * (`graph_node.cpp:634`, `graph_frame.cpp:106`):
 * `titlebar_hbox->get_size() + sb_titlebar->get_minimum_size()`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ControlColor } from '../control/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { getFontLinePitchPx, type FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import {
  resolveThemeFontIn,
  resolveThemeFontSizeIn,
  themeResolutionScope,
} from '../../../../resources/styles/theme/lookup';
import { peekSceneFontMetrics } from '../../../../r3f/controls/native/text/sceneFontLoader';
import {
  AutowrapMode,
  shapeText,
  shapedTextSizeWidthPx,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import { layoutLabelLines, LABEL_LINE_SPACING_PX, LABEL_PARAGRAPH_SEPARATOR } from '../label/nativeSolver';

/** `title_label`'s real Godot class: both variations are declared `set_type_variation("Label")`. */
const TITLE_LABEL_NATIVE_TYPE = 'Label';

export interface TitlebarFontTheme {
  fontSizePx: number;
  color: ControlColor;
  fontMetrics: FontMetrics;
}

/**
 * `title_label`'s font, through the theme walk every Control uses, rooted at
 * `n`: its parent `titlebar_hbox` carries no `theme`, so `n.themeChain` is
 * `title_label`'s chain. `theme_override_fonts/*` is local to `n` and never
 * inherited, so `title_label`, which can author no override, passes `undefined`.
 * @param defaultColor The whole colour answer, since no `Theme` colour is decoded
 *   (`textTheme.ts`): `control_font_color` for `GraphNodeTitleLabel`
 *   (`default_theme.cpp:819`), opaque white for `GraphFrameTitleLabel` (`:849`).
 */
export function resolveTitleFontTheme(
  n: SolveNode,
  typeVariation: string,
  builtInDefaultSizePx: number,
  defaultColor: ControlColor
): TitlebarFontTheme {
  const scope = themeResolutionScope(TITLE_LABEL_NATIVE_TYPE, typeVariation, n.themeChain, n.projectTheme);
  const fontSizePx = resolveThemeFontSizeIn(scope, 'font_size', undefined, builtInDefaultSizePx);
  const fontResource = resolveThemeFontIn(scope, 'font', undefined);
  const fontMetrics = peekSceneFontMetrics(fontResource, n.path);
  return { fontSizePx, color: defaultColor, fontMetrics };
}

/**
 * Shapes `text` as `Label::_shape` does for an unwrapped, non-uppercase Label,
 * the branch at `label.cpp:992-996`: `title_label` leaves `autowrap_mode` and
 * `uppercase` at their OFF/false defaults.
 */
export function shapeTitleText(text: string, fontTheme: TitlebarFontTheme): TextLayoutResult {
  return shapeText(text, {
    fontSizePx: fontTheme.fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.OFF,
    lineSpacingPx: LABEL_LINE_SPACING_PX,
    fontMetrics: fontTheme.fontMetrics,
    paragraphSeparator: LABEL_PARAGRAPH_SEPARATOR,
  });
}

/** The shaped title's own minimum size: `Label::get_minimum_size`'s OFF branch (`label.cpp:992-996`), empty-text short-circuit included. */
export function titleTextMinimumSize(
  text: string,
  fontTheme: TitlebarFontTheme
): { x: number; y: number } {
  if (text.length === 0) {
    // `label.cpp:239-241`: `Size2(1, get_line_height())`: `get_line_height()`
    // with no shaped lines returns `font->get_height(font_size)`, no
    // `line_spacing` folded in (`label.cpp:125-134`).
    return { x: 1, y: getFontLinePitchPx(fontTheme.fontMetrics, fontTheme.fontSizePx, 0) };
  }
  const layout = shapeTitleText(text, fontTheme);
  const height = Math.max(layout.heightPx - LABEL_LINE_SPACING_PX, 0);
  return { x: shapedTextSizeWidthPx(layout.widthPx), y: height };
}

export interface TitlebarGeometry {
  /** The titlebar StyleBox's own drawn rect, relative to the owning node's top-left. */
  rect: { x: number; y: number; w: number; h: number };
  /** `titlebar_hbox`'s own content rect (post `sb_titlebar` margins), where `title_label` draws. */
  contentRect: { x: number; y: number; w: number; h: number };
}

/** The titlebar band's converged geometry. `nodeWidth` is the owning node's solved width. */
export function titlebarGeometry(
  nodeWidth: number,
  textMinHeight: number,
  titlebarStyle: StyleBoxFlatData
): TitlebarGeometry {
  const { left, top, right, bottom } = titlebarStyle.contentMargin;
  const bandHeight = textMinHeight + top + bottom;
  return {
    rect: { x: 0, y: 0, w: nodeWidth, h: bandHeight },
    contentRect: { x: left, y: top, w: Math.max(0, nodeWidth - left - right), h: textMinHeight },
  };
}

/** `title_label`'s per-line placement within `contentRect`: `Label::_get_line_rect`. */
export { layoutLabelLines };
