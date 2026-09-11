/**
 * TextEdit's native (WebGL canvas) rect solver — `TextEdit::get_minimum_size`
 * (`scene/gui/text_edit.cpp:3491-3500`), backed by `_update_scrollbars`'s
 * `content_size_cache` (`:8587-8656`) — plus the per-line shaping, row
 * geometry and theme resolution `Component.tsx` reuses for painting.
 * `CodeEdit`'s own solver (`../codeedit/nativeSolver.ts`) calls every
 * exported function here with its own gutter width added in, since
 * `CodeEdit::get_minimum_size` is TextEdit's UNCHANGED (no override).
 *
 * SCROLL IS INERT. `scroll_horizontal`/`scroll_vertical` are parsed by
 * `linterParser.ts` but never read here or by `Component.tsx`: caret 0 is
 * constructed at (line 0, column 0) and nothing in a `.tscn` can move it
 * (no `caret_line`/`caret_column` property exists), so on the very first
 * `NOTIFICATION_DRAW`, `first_draw` is true and Godot calls
 * `adjust_viewport_to_caret()` (`text_edit.cpp:904-909`):
 *
 *   - Vertically (`adjust_viewport_to_caret`, `:6639-6659`): caret line
 *     0 < any authored `first_visible_line` > 0 reads as "caret above
 *     screen", so `set_line_as_first_visible(0, 0)` snaps the view back to
 *     line 0 whenever `scroll_vertical` scrolled past it.
 *   - Horizontally (`_adjust_viewport_to_caret_horizontally`,
 *     `:8666-8706`... actually `:8890-`): wrap mode != NONE forces
 *     `first_visible_col = 0` unconditionally up front; otherwise caret
 *     column 0's own x is `0`, and `caret_start_pos(0) < first_visible_col`
 *     forces `first_visible_col = 0` whenever `scroll_horizontal` was > 0.
 *
 * So a static, unfocused TextEdit ALWAYS shows from (line 0, col 0),
 * whatever `scroll_horizontal`/`scroll_vertical` say. `highlight_current_line`
 * therefore always highlights line 0's first wrapped row — the caret's own
 * line never varies either, for the identical reason.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { getFontLinePitchPx } from '../../../../r3f/controls/native/text/fontMetrics';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  AutowrapMode,
  clampAutowrapMode,
  shapeText,
  shapedTextSizeWidthPx,
  type TextLayoutResult,
} from '../../../../r3f/controls/native/text/textLayout';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import { contentMarginSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { ControlColor } from '../control/types';
import type { TextEditProperties } from './types';

/** `SceneStringName(font)` = `"font"` — `default_theme.cpp:460` (TextEdit), `:501` (CodeEdit). */
export const TEXT_EDIT_THEME_FONT_KEY = 'font';

/** `text_edit.cpp:4103`: `MAX(text.get_line_height() + theme_cache.line_spacing, 1)`. `Text::get_line_height()` (`:136-147`) is the max of every visible line's own `l.height`, which reduces to the font's own ascent+descent (no spacing) since every line in this codebase shapes at one uniform font/size. */
export function textEditRowHeightPx(
  fontMetrics: Parameters<typeof getFontLinePitchPx>[0],
  fontSizePx: number,
  themeLineSpacingPx: number
): number {
  return Math.max(getFontLinePitchPx(fontMetrics, fontSizePx, 0) + themeLineSpacingPx, 1);
}

/** `default_theme.cpp:482`: `theme->set_constant("wrap_offset", "TextEdit", 10)` — a BARE `10`, not `Math.round(10 * scale)` like its neighbouring constants; `_update_wrap_at_column` (`:8536-8543`) subtracts it unscaled. */
export const TEXT_EDIT_WRAP_OFFSET_PX = 10;

/** `text_edit.cpp:8614`: `content_size_cache = Vector2i(total_width + 10, ...)` — a second bare, unscaled `10`. */
export const TEXT_EDIT_CONTENT_WIDTH_PAD_PX = 10;

/**
 * `TextEdit::get_draw_mode`'s stylebox axis: which default-theme box this
 * node's `editable` selects. `default_theme.cpp:453,455` set TextEdit's own
 * `normal`/`read_only` styleboxes to the SAME `Ref<StyleBoxFlat>` objects as
 * LineEdit's (`style_line_edit`/`style_line_edit_read_only`) — CodeEdit
 * reuses the identical two Refs again (`:486,488`) — so `theme.widgets.lineEdit`
 * is this type's own default too, not a borrowed approximation.
 */
export type TextEditStyleState = 'normal' | 'read_only';

/** `editable ?? true` (TextEdit's own default, `text_edit.h`), collapsed to which stylebox key it selects. */
export function resolveTextEditStyleState(editable: boolean | undefined): TextEditStyleState {
  return editable === false ? 'read_only' : 'normal';
}

/** `overrides[state]` (a resolved `theme_override_styles/<state>`) wins; otherwise the default-theme struct for that state — see `TextEditStyleState`'s own doc for why LineEdit's defaults are TextEdit's too. */
export function pickTextEditStyleBox(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  lineEditDefaults: Readonly<Record<'normal' | 'readOnly', StyleBoxFlatData>>,
  state: TextEditStyleState
): StyleBoxFlatData {
  const key = state === 'read_only' ? 'readOnly' : 'normal';
  return overrides[state] ?? lineEditDefaults[key];
}

/** `control_font_color` = `Color(0.875, 0.875, 0.875)` (`default_theme.cpp:101`) — TextEdit's/CodeEdit's own `font_color` default (`:466`, `:512`). */
export const TEXT_EDIT_DEFAULT_FONT_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 1 };

/** `control_font_disabled_color` = `control_font_color * Color(1,1,1,0.5)` (`:106`) — TextEdit's `font_readonly_color` default (`:468`); CodeEdit computes the identical numeric value inline (`:513`). */
export const TEXT_EDIT_DEFAULT_READONLY_COLOR: ControlColor = { r: 0.875, g: 0.875, b: 0.875, a: 0.5 };

const TEXT_EDIT_THEME_KEYS: Record<TextEditStyleState, TextThemeKeys> = {
  normal: { sizeKey: 'font_size', colorKey: 'font_color' },
  read_only: { sizeKey: 'font_size', colorKey: 'font_readonly_color' },
};

const TEXT_EDIT_DEFAULT_COLORS: Record<TextEditStyleState, ControlColor> = {
  normal: TEXT_EDIT_DEFAULT_FONT_COLOR,
  read_only: TEXT_EDIT_DEFAULT_READONLY_COLOR,
};

/** Resolves this node's own theme font size/colour for `state` (overrides, else the ancestor Theme chain / theme default / TextEdit's own literal). Shared unchanged by CodeEdit — both types' defaults agree exactly (their own doc). */
export function textEditTextTheme(
  n: SolveNode,
  props: TextEditProperties,
  state: TextEditStyleState,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = { fontSizePx: ctx.theme.fontSize, color: TEXT_EDIT_DEFAULT_COLORS[state] };
  return resolveTextTheme(n, props, TEXT_EDIT_THEME_KEYS[state], defaults);
}

/** A single buffer line's already-shaped rows plus its own start row index within the whole TextEdit. */
export interface TextEditLineLayout {
  layout: TextLayoutResult;
  startRow: number;
}

/**
 * Shapes every buffer line (`text.split('\n')`) independently, mirroring
 * `TextEdit::Text`: each `Line` owns its own `TextParagraph`, so a wrap break
 * in one line never affects another's. `wrapMode === LINE_WRAPPING_BOUNDARY`
 * (1) is the only case that wraps at all (`_update_wrap_at_column`,
 * `text_edit.cpp:8536-8586`); NONE (0, the default) always shapes OFF.
 */
export function shapeTextEditLines(
  lines: readonly string[],
  fontSizePx: number,
  wrapMode: number | undefined,
  autowrapMode: number | undefined,
  wrapWidthPx: number,
  fontMetrics: Parameters<typeof shapeText>[1]['fontMetrics']
): TextEditLineLayout[] {
  const mode =
    wrapMode === 1 ? clampAutowrapMode(autowrapMode, AutowrapMode.WORD_SMART) : AutowrapMode.OFF;
  let row = 0;
  return lines.map((line) => {
    const layout = shapeText(line, {
      fontSizePx,
      boxWidthPx: mode === AutowrapMode.OFF ? 0 : wrapWidthPx,
      autowrapMode: mode,
      lineSpacingPx: 0,
      fontMetrics,
    });
    const entry: TextEditLineLayout = { layout, startRow: row };
    row += layout.lines.length;
    return entry;
  });
}

/**
 * `_update_wrap_at_column` (`text_edit.cpp:8536-8543`), restricted to what
 * this previewer models: no v-scrollbar term (scrollbars are never drawn —
 * see `Component.tsx`'s own doc).
 *
 *     int new_wrap_at = get_size().width - style->get_minimum_size().width - gutters_width - gutter_padding;
 *     if (draw_minimap) new_wrap_at -= minimap_width;
 *     new_wrap_at -= theme_cache.wrap_offset; // bare 10
 *
 * `gutterBandWidthPx` is `gutters_width + gutter_padding` COMBINED — the two
 * terms never appear apart at any of this module's call sites, so every
 * function here takes their sum as one number (`0` for a bare `TextEdit`,
 * `CodeEdit`'s own `codeEditGutterBand`'s `totalWidthPx` for `CodeEdit`).
 */
export function textEditWrapWidthPx(
  rectWidthPx: number,
  styleMinWidthPx: number,
  gutterBandWidthPx: number,
  minimapWidthPx: number,
  drawMinimap: boolean | undefined
): number {
  let width = rectWidthPx - styleMinWidthPx - gutterBandWidthPx;
  if (drawMinimap) width -= minimapWidthPx;
  width -= TEXT_EDIT_WRAP_OFFSET_PX;
  return Math.trunc(width);
}

/**
 * `_update_scrollbars`'s `content_size_cache` (`text_edit.cpp:8601-8614`),
 * restricted to `fit_content_height`/`fit_content_width`'s own inputs (no
 * `scroll_past_end_of_file`/`placeholder` term — see `Component.tsx`'s own
 * doc for the scope this previewer draws):
 *
 *     int total_rows = get_total_visible_line_count();
 *     int total_width = text.get_max_width() + gutters_width + gutter_padding;
 *     if (draw_minimap) total_width += minimap_width;
 *     content_size_cache = Vector2i(total_width + 10, MAX(total_rows, 1) * get_line_height());
 *
 * `text.get_max_width()` is each line's OWN `data_buf->get_size().x` — the
 * CEILED width of its widest row, wrapped or not — maxed across every line;
 * ported here as the max `shapedTextSizeWidthPx` over every shaped row.
 */
export function textEditContentSize(
  lineLayouts: readonly TextEditLineLayout[],
  rowHeightPx: number,
  gutterBandWidthPx: number,
  minimapWidthPx: number,
  drawMinimap: boolean | undefined
): Vec2 {
  let maxRowWidthPx = 0;
  let totalRows = 0;
  for (const { layout } of lineLayouts) {
    totalRows += layout.lines.length;
    for (const line of layout.lines) {
      maxRowWidthPx = Math.max(maxRowWidthPx, shapedTextSizeWidthPx(line.widthPx));
    }
  }
  let totalWidth = maxRowWidthPx + gutterBandWidthPx;
  if (drawMinimap) totalWidth += minimapWidthPx;
  return {
    x: totalWidth + TEXT_EDIT_CONTENT_WIDTH_PAD_PX,
    y: Math.max(totalRows, 1) * rowHeightPx,
  };
}

/**
 * `TextEdit::get_minimum_size` (`text_edit.cpp:3491-3500`):
 *
 *     Size2 ms = _get_current_stylebox()->get_minimum_size();
 *     if (fit_content_height) ms.height += content_size_cache.height;
 *     if (fit_content_width) ms.width += content_size_cache.width;
 *     return ms;
 *
 * `style->get_minimum_size()` floors against the ACTIVE stylebox only
 * (unlike LineEdit, which floors against BOTH regardless of state) —
 * `_get_current_stylebox()` (`:1273-1280`) returns `read_only` whenever
 * `!editable`, else `normal`.
 *
 * `content_size_cache.height` is wrap-width-dependent whenever
 * `wrap_mode === LINE_WRAPPING_BOUNDARY`, so this registers via
 * `controlSolverRegistry.registerSizeDependentMinimum` exactly like Label:
 * pass 1 (no `tentativeRect`) shapes unwrapped; pass 2 shapes at this node's
 * own resolved width. `CodeEdit`'s solver (`../codeedit/nativeSolver.ts`)
 * calls this SAME function with its own `gutterBandWidthPx` folded in.
 */
export function textEditMinimumSizeWith(
  n: SolveNode,
  ctx: SolveContext,
  props: TextEditProperties,
  styleBox: StyleBoxFlatData,
  gutterBandWidthPx: number
): Vec2 {
  const styleMin = contentMarginSize(styleBox);
  const state = resolveTextEditStyleState(props.editable);
  const { fontSizePx } = textEditTextTheme(n, props, state, ctx);
  const fontMetrics = resolveNodeFontMetrics(n, TEXT_EDIT_THEME_FONT_KEY);
  // Same constant both `TextEdit` (`default_theme.cpp:479`) and `BoxContainer`
  // (`godotDefaultTheme.ts`'s `DEFAULT_SEPARATION`) declare independently as
  // `Math.round(4 * scale)` — numerically identical at every scale, reused
  // here rather than re-deriving a second scaled `4` this codebase has no raw
  // `scale` value to build (`nativeTheme.ts` never re-exports it).
  const lineSpacingPx = ctx.theme.separation;

  if (!props.fitContentWidth && !props.fitContentHeight) return styleMin;

  const rectWidthPx = ctx.tentativeRect?.(n)?.w;
  const wrapWidthPx =
    rectWidthPx === undefined
      ? 0
      : textEditWrapWidthPx(rectWidthPx, styleMin.x, gutterBandWidthPx, props.minimapWidth ?? 80, props.minimapDraw);
  const effectiveWrapMode = rectWidthPx === undefined ? 0 : props.wrapMode;

  const lines = (props.text ?? '').split('\n');
  const lineLayouts = shapeTextEditLines(
    lines,
    fontSizePx,
    effectiveWrapMode,
    props.autowrapMode,
    wrapWidthPx,
    fontMetrics
  );
  const rowHeightPx = textEditRowHeightPx(fontMetrics, fontSizePx, lineSpacingPx);
  const content = textEditContentSize(
    lineLayouts,
    rowHeightPx,
    gutterBandWidthPx,
    props.minimapWidth ?? 80,
    props.minimapDraw
  );

  return {
    x: styleMin.x + (props.fitContentWidth ? content.x : 0),
    y: styleMin.y + (props.fitContentHeight ? content.y : 0),
  };
}

export const textEditMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as TextEditProperties;
  const state = resolveTextEditStyleState(props.editable);
  const styleBox = pickTextEditStyleBox(n.styleBoxes, ctx.theme.widgets.lineEdit, state);
  return textEditMinimumSizeWith(n, ctx, props, styleBox, 0);
};

// --- Draw-time layout --------------------------------------------------

export interface TextEditDrawLayout {
  /** `Math.ceil(style->get_margin(SIDE_LEFT))` (`text_edit.cpp:938`), plus any gutter width/padding this caller passes in. */
  xMarginBeginPx: number;
  /** `size.width - Math.floor(style->get_margin(SIDE_RIGHT))`, minus the minimap when drawn (`:941-944`). */
  xMarginEndPx: number;
  /** This node's own row pitch — `textEditRowHeightPx`'s own doc. */
  rowHeightPx: number;
}

/**
 * `left_margin`/`xmargin_end` (`text_edit.cpp:938,941-944`), the row band
 * every visible line draws inside. `gutterBandWidthPx` is `gutters_width +
 * gutter_padding` combined — `textEditWrapWidthPx`'s own doc.
 */
export function layoutTextEditDrawBand(
  rectWidthPx: number,
  styleBox: StyleBoxFlatData,
  gutterBandWidthPx: number,
  minimapWidthPx: number,
  drawMinimap: boolean | undefined,
  rowHeightPx: number
): TextEditDrawLayout {
  const xMarginBeginPx = Math.ceil(styleBox.contentMargin.left) + gutterBandWidthPx;
  let xMarginEndPx = rectWidthPx - Math.floor(styleBox.contentMargin.right);
  if (drawMinimap) xMarginEndPx -= minimapWidthPx;
  return { xMarginBeginPx, xMarginEndPx, rowHeightPx };
}
