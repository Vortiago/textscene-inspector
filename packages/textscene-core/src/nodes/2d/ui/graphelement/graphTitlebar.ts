/**
 * The titlebar band GraphNode/GraphFrame each build from an INTERNAL
 * `HBoxContainer` (`titlebar_hbox`) holding one internal `Label`
 * (`title_label`, theme type variation `GraphNodeTitleLabel`/
 * `GraphFrameTitleLabel`) — `graph_node.cpp:1322-1334`,
 * `graph_frame.cpp:348-360`. Neither internal node is ever serialised (both
 * are `add_child(..., INTERNAL_MODE_FRONT)`), so nothing here reads a
 * `.tscn` property for them beyond the owning node's own `title` string.
 *
 * `titlebar_hbox` has `h_size_flags = SIZE_EXPAND_FILL`, default (FILL)
 * `v_size_flags`, and its own combined minimum size is exactly
 * `title_label`'s (its one child, `HBoxContainer::get_minimum_size` with one
 * entry). `_resort`'s own `Rect2(sb_titlebar->get_offset(), titlebar_size)`
 * feeds `fit_child_in_rect` a height ALREADY REDUCED by `sb_titlebar`'s
 * margins — smaller than `titlebar_hbox`'s own minimum whenever those
 * margins are positive — so `Control::set_rect`'s universal minimum-size
 * floor (`control.cpp:1773-1797`, ported for every other container by
 * `controlRectSolver.ts`'s `dispatchChildren`, but not reachable here since
 * `titlebar_hbox` is not a real `SolveNode`) always wins and raises
 * `titlebar_hbox`'s resolved height back up to the title text's own minimum
 * height. The converged, closed-form answer this module computes directly
 * (`titlebarBandHeight`) is therefore INDEPENDENT of `sb_titlebar`'s margins,
 * which only ever shrink the pre-floor value below that floor, never past
 * it — matching what `NOTIFICATION_DRAW`'s own `titlebar_rect` reads back
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

/** `title_label`'s real Godot class — both variations are declared `set_type_variation("Label")`. */
const TITLE_LABEL_NATIVE_TYPE = 'Label';

export interface TitlebarFontTheme {
  fontSizePx: number;
  color: ControlColor;
  fontMetrics: FontMetrics;
}

/**
 * `title_label`'s resolved font — the SAME ancestor + type-chain walk any
 * other Control's theme font goes through (`resolveThemeFontIn`/
 * `resolveThemeFontSizeIn`), rooted at `n`'s own `themeChain`/`projectTheme`:
 * `title_label`'s nearest CONTROL ancestor carrying a `theme` resource is
 * `n` itself (its parent, `titlebar_hbox`, is a bare internal `HBoxContainer`
 * with no `theme` of its own), so `n.themeChain` already IS `title_label`'s
 * own ancestor chain, unlike `n.fontOverrides` — `theme_override_fonts/*` is
 * a LOCAL override only `n`'s OWN theme key would read, never inherited by a
 * child, so `title_label` (which can author no override at all) passes
 * `undefined` rather than any of `n`'s.
 *
 * Colour has no such ancestor walk in this codebase (`textTheme.ts`'s own
 * doc — colour data is not decoded from a `Theme` resource at all), so
 * `defaultColor` is the whole answer: `GraphNodeTitleLabel`'s is
 * `control_font_color` (`default_theme.cpp:819`); `GraphFrameTitleLabel`'s is
 * opaque white (`:849`).
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
 * Shapes `text` exactly as `Label::_shape` does for an unwrapped, non-uppercase
 * Label (`title_label` sets neither `autowrap_mode` nor `uppercase` — both
 * stay at `Label`'s own OFF/false defaults) — `label.cpp:992-996`'s branch,
 * transcribed once and shared by both `labelMinimumSize` (via `shapeText`
 * directly) and here, rather than re-derived.
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

/** The shaped title's own minimum size — `Label::get_minimum_size`'s OFF branch (`label.cpp:992-996`), empty-text short-circuit included. */
export function titleTextMinimumSize(
  text: string,
  fontTheme: TitlebarFontTheme
): { x: number; y: number } {
  if (text.length === 0) {
    // `label.cpp:239-241`: `Size2(1, get_line_height())` — `get_line_height()`
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

/**
 * The titlebar band's converged geometry — this module's own doc for why the
 * closed form is independent of `sb_titlebar`'s margins on the HEIGHT axis.
 * `nodeWidth` is the owning GraphNode/GraphFrame's own solved width.
 */
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

/** `title_label`'s own per-line placement within `contentRect` — `Label::_get_line_rect`, shared verbatim via `layoutLabelLines`. */
export { layoutLabelLines };
