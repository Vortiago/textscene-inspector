/**
 * TextEdit's native (WebGL canvas) rect solver: `get_minimum_size` (`scene/gui/text_edit.cpp:3491-3500`)
 * over `content_size_cache` (`:8587-8656`), with the shaping, row geometry and theme `Component.tsx`
 * paints with. CodeEdit calls these with its gutter width added. Scroll is inert: no `.tscn` moves caret
 * 0 from (0, 0), so the first draw's `adjust_viewport_to_caret()` (`:904-909`) snaps both scrolls back.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import {
  getFontTabStopsPx,
  getFontLinePitchPx,
  type FontMetrics,
} from '../../../../r3f/controls/native/text/fontMetrics';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import {
  controlBidiOptions,
  type TextBidiOptions,
} from '../../../../r3f/controls/native/text/textBidiOptions';
import {
  clampAutowrapMode,
  shapeText,
  shapedTextSizeWidthPx,
  type GlyphPlacement,
  type TextLayoutResult,
  type TextLineLayout,
} from '../../../../r3f/controls/native/text/textLayout';
import {
  resolveTextTheme,
  type ResolvedTextTheme,
  type TextThemeDefaults,
  type TextThemeKeys,
} from '../../../../r3f/controls/native/textTheme';
import { contentMarginSize, type StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { CodeHighlighterColorSpan } from '../../../../resources/styles/codehighlighter/highlight';
import type { TextEditProperties } from './types';
import type { Vector2 } from '../../../../godot/math/vector';
import type { Rgba } from '../../../../godot/math/math';
import {
  CONTROL_FONT_COLOR,
  CONTROL_FONT_DISABLED_COLOR,
  CONTROL_FONT_PLACEHOLDER_COLOR,
} from '../../../../godot/scene/theme';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';

/** `SceneStringName(font)` = `"font"`: `default_theme.cpp:460` (TextEdit), `:501` (CodeEdit). */
export const TEXT_EDIT_THEME_FONT_KEY = 'font';

/** `text_edit.cpp:4103`: `MAX(text.get_line_height() + theme_cache.line_spacing, 1)`. `Text::get_line_height()` (`:136-147`) is the max of every visible line's own `l.height`, which reduces to the font's own ascent+descent (no spacing) since every line in this codebase shapes at one uniform font/size. */
export function textEditRowHeightPx(
  fontMetrics: Parameters<typeof getFontLinePitchPx>[0],
  fontSizePx: number,
  themeLineSpacingPx: number
): number {
  return Math.max(getFontLinePitchPx(fontMetrics, fontSizePx, 0) + themeLineSpacingPx, 1);
}

/** `default_theme.cpp:482`: `theme->set_constant("wrap_offset", "TextEdit", 10)`, a bare `10`, not `Math.round(10 * scale)` like its neighbours. `_update_wrap_at_column` (`:8536-8543`) subtracts it unscaled. */
const TEXT_EDIT_WRAP_OFFSET_PX = 10;

/** `text_edit.cpp:8614`: `content_size_cache = Vector2i(total_width + 10, ...)`, a second bare, unscaled `10`. */
const TEXT_EDIT_CONTENT_WIDTH_PAD_PX = 10;

/**
 * `TextEdit::get_draw_mode`'s stylebox axis. TextEdit's `normal`/`read_only` are the same
 * `Ref<StyleBoxFlat>` objects as LineEdit's (`default_theme.cpp:453,455`), as are CodeEdit's
 * (`:486,488`), so `theme.widgets.lineEdit` is this type's own default.
 */
type TextEditStyleState = 'normal' | 'read_only';

/** `editable ?? true` (TextEdit's own default, `text_edit.h`), collapsed to which stylebox key it selects. */
export function resolveTextEditStyleState(editable: boolean | undefined): TextEditStyleState {
  return editable === false ? 'read_only' : 'normal';
}

/** `overrides[state]` (a resolved `theme_override_styles/<state>`) wins over the default-theme box for that state, which is LineEdit's (`TextEditStyleState`). */
export function pickTextEditStyleBox(
  overrides: Readonly<Record<string, StyleBoxFlatData>>,
  lineEditDefaults: Readonly<Record<'normal' | 'readOnly', StyleBoxFlatData>>,
  state: TextEditStyleState
): StyleBoxFlatData {
  const key = state === 'read_only' ? 'readOnly' : 'normal';
  return overrides[state] ?? lineEditDefaults[key];
}

/** The `font_color` default of TextEdit and CodeEdit (`default_theme.cpp:466`, `:514`). */
const TEXT_EDIT_DEFAULT_FONT_COLOR = CONTROL_FONT_COLOR;

/** TextEdit's `font_readonly_color` default (`default_theme.cpp:468`). CodeEdit computes the same value inline (`:516`). */
const TEXT_EDIT_DEFAULT_READONLY_COLOR = CONTROL_FONT_DISABLED_COLOR;

/** TextEdit's `font_placeholder_color` default (`default_theme.cpp:469`). CodeEdit's is the same (`:517`). */
const TEXT_EDIT_DEFAULT_PLACEHOLDER_COLOR = CONTROL_FONT_PLACEHOLDER_COLOR;

/** The text states `NOTIFICATION_DRAW` picks a colour for: the placeholder wins over `editable` (`text_edit.cpp:1346-1352`). */
type TextEditTextState = TextEditStyleState | 'placeholder';

const TEXT_EDIT_THEME_KEYS: Record<TextEditTextState, TextThemeKeys> = {
  normal: { sizeKey: 'font_size', colorKey: 'font_color' },
  read_only: { sizeKey: 'font_size', colorKey: 'font_readonly_color' },
  placeholder: { sizeKey: 'font_size', colorKey: 'font_placeholder_color' },
};

const TEXT_EDIT_DEFAULT_COLORS: Record<TextEditTextState, Rgba> = {
  normal: TEXT_EDIT_DEFAULT_FONT_COLOR,
  read_only: TEXT_EDIT_DEFAULT_READONLY_COLOR,
  placeholder: TEXT_EDIT_DEFAULT_PLACEHOLDER_COLOR,
};

/** Resolves this node's theme font size and colour for `state` (overrides, else the ancestor Theme chain, theme default or TextEdit's literal). CodeEdit shares it, since its defaults are the same. */
export function textEditTextTheme(
  n: SolveNode,
  props: TextEditProperties,
  state: TextEditTextState,
  ctx: Pick<SolveContext, 'theme'>
): ResolvedTextTheme {
  const defaults: TextThemeDefaults = {
    fontSizePx: ctx.theme.fontSize,
    color: TEXT_EDIT_DEFAULT_COLORS[state],
  };
  return resolveTextTheme(n, props, TEXT_EDIT_THEME_KEYS[state], defaults);
}

/**
 * `_using_placeholder` (`text_edit.cpp:3377-3379`): a buffer of one empty line draws `placeholder_text` in its
 * place, as one paragraph that breaks at its own newlines. A buffer of `\n` holds two lines and is real text.
 */
export function textEditDrawnLines(
  text: string | undefined,
  placeholderText: string | undefined
): { lines: string[]; isPlaceholder: boolean } {
  if (!text) return { lines: [placeholderText ?? ''], isPlaceholder: true };
  return { lines: text.split('\n'), isPlaceholder: false };
}

/** A single buffer line's already-shaped rows plus its own start row index within the whole TextEdit. */
interface TextEditLineLayout {
  layout: TextLayoutResult;
  startRow: number;
}

/** What each buffer line shapes with, beyond its text. */
interface TextEditShapeOptions {
  fontSizePx: number;
  fontMetrics: FontMetrics;
  /** `LineWrappingMode`. Only `LINE_WRAPPING_BOUNDARY` (1) wraps. */
  wrapMode?: number;
  autowrapMode?: number;
  wrapWidthPx?: number;
  tabStopsPx?: number[];
  /** `draw_control_chars`. */
  preserveControl?: boolean;
  /** `indent_wrapped_lines`: adds `BREAK_TRIM_INDENT` (`text_edit.cpp:285-287`). */
  indentWrappedLines?: boolean;
  /** Every line's direction, language and override ranges (`text_edit.cpp:3394-3401`). */
  bidi?: TextBidiOptions;
  /**
   * Shapes `lines` as the placeholder paragraph. Its override is dropped: `_update_placeholder` sets
   * `placeholder_bidi_override` only when it is empty (`text_edit.cpp:3349-3351`), so none applies.
   */
  placeholder?: boolean;
}

/**
 * Shapes each buffer line on its own, as each `TextEdit::Text` `Line` owns a `TextParagraph`, so an
 * AUTO line infers its own direction and the structured parser runs per line (`text_edit.cpp:297-324`).
 * Only `LINE_WRAPPING_BOUNDARY` wraps (`_update_wrap_at_column`, `:8536-8586`). `indentWrappedLines`
 * narrows each row past the leading whitespace. {@link textEditWrapIndentPx} is the matching draw-side step-in.
 */
export function shapeTextEditLines(
  lines: readonly string[],
  options: TextEditShapeOptions
): TextEditLineLayout[] {
  const {
    fontSizePx,
    fontMetrics,
    wrapMode,
    autowrapMode,
    wrapWidthPx = 0,
    tabStopsPx = [],
    preserveControl = false,
    indentWrappedLines = false,
    bidi,
    placeholder = false,
  } = options;
  const lineBidi = placeholder ? { ...bidi, bidiOverride: undefined } : bidi;
  const mode =
    wrapMode === 1
      ? clampAutowrapMode(autowrapMode, AutowrapMode.AUTOWRAP_WORD_SMART)
      : AutowrapMode.AUTOWRAP_OFF;
  let row = 0;
  return lines.map((line) => {
    const layout = shapeText(line, {
      fontSizePx,
      boxWidthPx: mode === AutowrapMode.AUTOWRAP_OFF ? 0 : wrapWidthPx,
      autowrapMode: mode,
      lineSpacingPx: 0,
      fontMetrics,
      tabStopsPx,
      preserveControl,
      trimIndent: indentWrappedLines,
      ...lineBidi,
    });
    const entry: TextEditLineLayout = { layout, startRow: row };
    row += layout.lines.length;
    return entry;
  });
}

/**
 * `_update_wrap_at_column` (`text_edit.cpp:8536-8543`) without the v-scrollbar term, since no
 * scrollbar draws: `width - style min width - gutters_width - gutter_padding`, less `minimap_width`
 * when drawn, less the bare 10 `wrap_offset`. `gutterBandWidthPx` is the gutter sum, never split at
 * a call site: 0 for TextEdit, `codeEditGutterBand`'s `totalWidthPx` for CodeEdit.
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
 * `_update_scrollbars`'s `content_size_cache` (`text_edit.cpp:8601-8614`) for `fit_content_*`,
 * without the `scroll_past_end_of_file` term: `(max width + gutters + minimap when
 * drawn + 10, MAX(total_rows, 1) * line_height)`. `text.get_max_width()` is the widest row's ceiled
 * `data_buf` width, here the max `shapedTextSizeWidthPx` over every shaped row.
 */
function textEditContentSize(
  lineLayouts: readonly TextEditLineLayout[],
  rowHeightPx: number,
  gutterBandWidthPx: number,
  minimapWidthPx: number,
  drawMinimap: boolean | undefined
): Vector2 {
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
 * The default `tab_size` (`text_edit.h:197`). A bare TextEdit has no `.tscn` property for it:
 * only `CodeEdit.indent_size` forwards to it (`code_edit.cpp:908-920`).
 */
export const TEXT_EDIT_DEFAULT_TAB_SIZE = 4;

/** `Text::invalidate_cache` (`text_edit.cpp:348-352`, and `invalidate_all_lines`, `:394-398`). */
export function textEditTabStopsPx(
  tabSize: number | undefined,
  fontMetrics: FontMetrics,
  fontSizePx: number
): number[] {
  return getFontTabStopsPx(fontMetrics, tabSize ?? TEXT_EDIT_DEFAULT_TAB_SIZE, fontSizePx);
}

/**
 * `TextEdit::get_minimum_size` (`text_edit.cpp:3491-3500`): the active stylebox's minimum (`read_only`
 * when `!editable`, `:1273-1280`, unlike LineEdit's both), plus each `fit_content_*` axis, as in
 * `ms.height += content_size_cache.height`. Under BOUNDARY wrap the height depends on width, so,
 * as for Label, pass 1 shapes unwrapped and pass 2 at the resolved width.
 */
export function textEditMinimumSizeWith(
  n: SolveNode,
  ctx: SolveContext,
  props: TextEditProperties,
  styleBox: StyleBoxFlatData,
  gutterBandWidthPx: number,
  tabSize?: number
): Vector2 {
  const styleMin = contentMarginSize(styleBox);
  const state = resolveTextEditStyleState(props.editable);
  const { fontSizePx } = textEditTextTheme(n, props, state, ctx);
  const fontMetrics = resolveNodeFontMetrics(n, TEXT_EDIT_THEME_FONT_KEY);
  // TextEdit's `line_spacing` (`default_theme.cpp:479`) and BoxContainer's `DEFAULT_SEPARATION`
  // are both `Math.round(4 * scale)`, and `nativeTheme.ts` exposes no raw `scale` to derive it.
  const lineSpacingPx = ctx.theme.separation;

  if (!props.fitContentWidth && !props.fitContentHeight) return styleMin;

  const rectWidthPx = ctx.tentativeRect?.(n)?.w;
  const wrapWidthPx =
    rectWidthPx === undefined
      ? 0
      : textEditWrapWidthPx(
          rectWidthPx,
          styleMin.x,
          gutterBandWidthPx,
          props.minimapWidth ?? 80,
          props.minimapDraw
        );
  const effectiveWrapMode = rectWidthPx === undefined ? 0 : props.wrapMode;

  const { lines, isPlaceholder } = textEditDrawnLines(props.text, props.placeholderText);
  const lineLayouts = shapeTextEditLines(lines, {
    fontSizePx,
    fontMetrics,
    wrapMode: effectiveWrapMode,
    autowrapMode: props.autowrapMode,
    wrapWidthPx,
    tabStopsPx: textEditTabStopsPx(tabSize, fontMetrics, fontSizePx),
    preserveControl: props.drawControlChars,
    indentWrappedLines: props.indentWrappedLines,
    bidi: controlBidiOptions(props, n),
    placeholder: isPlaceholder,
  });
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

interface TextEditDrawLayout {
  /** `Math.ceil(style->get_margin(SIDE_LEFT))` (`text_edit.cpp:938`), plus any gutter width/padding this caller passes in. */
  xMarginBeginPx: number;
  /** `size.width - Math.floor(style->get_margin(SIDE_RIGHT))`, minus the minimap when drawn (`:941-944`). */
  xMarginEndPx: number;
  /** This node's row pitch (`textEditRowHeightPx`). */
  rowHeightPx: number;
}

/**
 * `left_margin`/`xmargin_end` (`text_edit.cpp:938,941-944`), the row band
 * every visible line draws inside. `gutterBandWidthPx` is `gutters_width +
 * gutter_padding` combined (`textEditWrapWidthPx`).
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

/**
 * One drawn row's band top, `ofs_y = style->get_margin(SIDE_TOP) + i * row_height + line_spacing / 2`
 * (`text_edit.cpp:1376-1378`), with the scroll terms (`:1379-1380`) at 0. Caret line 0 resets a positive
 * `first_visible_line` (`:6639-6659`), and a wrap mode or caret column 0 resets `first_visible_col` (`:8820-8884`).
 * The per-line background and `highlight_current_line`, always on line 0, fill this band, and the text centres in it.
 */
export function textEditRowBandTopPx(
  row: number,
  rowHeightPx: number,
  styleMarginTopPx: number,
  lineSpacingPx: number
): number {
  return styleMarginTopPx + row * rowHeightPx + lineSpacingPx / 2;
}

/**
 * The row's text top inside the band: `ofs_y += (row_height - text_height) / 2`
 * (`text_edit.cpp:1626`). The glyph baseline is one ascent lower, and `<TextRun>`
 * anchors a line by this top edge.
 */
export function textEditRowTextTopPx(bandTopPx: number, rowHeightPx: number, textHeightPx: number): number {
  return bandTopPx + (rowHeightPx - textHeightPx) / 2;
}

/**
 * The caret rect a still frame draws, or `null` (`text_edit.cpp:926-927,945-947,1858-1877`).
 * An unfocused frame clears `draw_caret` (`:926-927`), and `caret_draw_when_editable_disabled`
 * restores it while `!editable` (`:945-947`). The "normal caret" arm (`:1858-1877`) puts caret 0
 * at `xmargin_beg`, `caret_width` wide, over the row's text box (`-ascent`, ascent + descent tall).
 */
export function textEditCaretRect(
  editable: boolean,
  drawWhenEditableDisabled: boolean,
  xMarginBeginPx: number,
  bandTopPx: number,
  rowHeightPx: number,
  textHeightPx: number,
  caretWidthPx: number
): Rect2 | null {
  // `caret_type` needs a focused frame, and `overtype_mode` is runtime state, so neither arm runs.
  if (editable || !drawWhenEditableDisabled) return null;
  return {
    x: xMarginBeginPx,
    y: textEditRowTextTopPx(bandTopPx, rowHeightPx, textHeightPx),
    w: caretWidthPx,
    h: textHeightPx,
  };
}

/**
 * `Text::get_indent_offset` (`text_edit.cpp:190-217`), capped at `wrap_at_column * 0.6` like its
 * caller (`:1363`). The leading tabs and spaces count at their shaped advances, over `line_length - 1`
 * (`:196`), so an all-whitespace line skips its last character. The run lives on `row0`, since the
 * `BREAK_TRIM_INDENT` gate (`text_server.cpp:1169`) refuses a soft break inside it.
 */
export function textEditWrapIndentPx(row0: TextLineLayout, lineText: string, wrapWidthPx: number): number {
  let indentPx = 0;
  const countable = Math.min(lineText.length - 1, row0.glyphs.length);
  for (let i = 0; i < countable; i++) {
    const ch = lineText[i]!;
    if (ch !== '\t' && ch !== ' ') break;
    indentPx += row0.glyphs[i]!.advance;
  }
  return Math.min(indentPx, wrapWidthPx * 0.6);
}

/**
 * `_get_wrapped_indent_level`'s `r_first_wrap` (`text_edit.cpp:4107-4131`): how many wrap ranges
 * the leading whitespace spans. A row at or before it draws flush, and a later row steps in by
 * {@link textEditWrapIndentPx} (`:1488`).
 */
export function textEditFirstIndentRow(lineText: string, rowStartIndices: readonly number[]): number {
  let firstWrap = 0;
  const countable = lineText.length - 1;
  for (let i = 0; i < countable; i++) {
    if (firstWrap + 1 < rowStartIndices.length && i >= rowStartIndices[firstWrap + 1]!) firstWrap++;
    const ch = lineText[i]!;
    if (ch !== '\t' && ch !== ' ') break;
  }
  return firstWrap;
}

/**
 * One drawn row's left edge, `char_margin` (`text_edit.cpp:1490-1494`). LTR takes the band start
 * plus `wrap_indent`. RTL mirrors the band start and steps back by the row's shaped width and
 * that indent, so each row sits by its own extent.
 */
export function textEditRowOriginXPx(
  xMarginBeginPx: number,
  rectWidthPx: number,
  rowWidthPx: number,
  rtl: boolean,
  wrapIndentPx = 0
): number {
  if (!rtl) return xMarginBeginPx + wrapIndentPx;
  return rectWidthPx - xMarginBeginPx - shapedTextSizeWidthPx(rowWidthPx) - wrapIndentPx;
}

/**
 * The current-line highlight quad's own left edge (`text_edit.cpp:1404-1409`).
 * Its width is `xmargin_end` in both arms. Only the origin moves, so the band
 * runs from the control's leading edge to `xmargin_end` either way.
 */
export function textEditCurrentLineXPx(xMarginEndPx: number, rectWidthPx: number, rtl: boolean): number {
  return rtl ? rectWidthPx - xMarginEndPx : 0;
}

/**
 * Each row's start index in its buffer line, which a `CodeHighlighter` colours by character
 * (`resources/styles/codehighlighter/highlight.ts`). Glyphs carry no index, so this finds each row's
 * trimmed `.text` in the untrimmed line, forward from the previous row: a trimmed boundary space
 * cannot misplace it, and the shaper's break indices are not needed.
 */
export function textEditRowStartIndices(lineText: string, rows: readonly TextLineLayout[]): number[] {
  const starts: number[] = [];
  let searchFrom = 0;
  for (const row of rows) {
    const foundAt = lineText.indexOf(row.text, searchFrom);
    const start = foundAt >= 0 ? foundAt : searchFrom;
    starts.push(start);
    searchFrom = start + row.text.length;
  }
  return starts;
}

function colorAt(spans: readonly CodeHighlighterColorSpan[], index: number, fallback: Rgba): Rgba {
  for (const span of spans) {
    if (index >= span.startIndex && index < span.endIndex) return span.color;
  }
  return fallback;
}

/**
 * The buffer-line index a glyph's colour is read at: `glyphs[j].start` (`text_edit.cpp:1674`). A
 * decomposed character's marks share their base's index, so the glyph's place in the row is only
 * the fallback for a glyph with no `sourceIndex`.
 */
export function textEditGlyphLineIndex(
  glyph: GlyphPlacement,
  rowStartIndex: number,
  glyphIndex: number
): number {
  return glyph.sourceIndex ?? rowStartIndex + glyphIndex;
}

/**
 * The glyph colour at `lineIndex`: `text_edit.cpp:1674`'s `gl_color = current_color`, which also
 * tints the `tab`/`space` icons (`:1714,1718`), not a fixed `font_color`. With no highlighter
 * (`spans` undefined) it is `fallback`, as in `textEditRowColorRuns`.
 */
export function textEditGlyphColorAt(
  spans: readonly CodeHighlighterColorSpan[] | undefined,
  lineIndex: number,
  fallback: Rgba
): Rgba {
  return spans ? colorAt(spans, lineIndex, fallback) : fallback;
}

function sameColor(a: Rgba, b: Rgba): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

interface TextEditGlyphColorRun {
  glyphs: GlyphPlacement[];
  color: Rgba;
}

/**
 * Which glyphs of one row `NOTIFICATION_DRAW` draws (`text_edit.cpp:1724`): a glyph whose advance box
 * starts before `xmargin_beg` or ends past `xmargin_end` is dropped whole, not clipped. The walk stops
 * after the first glyph whose pen reaches `xmargin_end` (`:1736-1738`), so the array ends there and a
 * later glyph, with its tab or space icon, is not visited. `charMarginPx` is the row's pen origin.
 */
export function textEditDrawnGlyphs(
  rowGlyphs: readonly GlyphPlacement[],
  charMarginPx: number,
  xMarginBeginPx: number,
  xMarginEndPx: number
): boolean[] {
  const drawn: boolean[] = [];
  for (const glyph of rowGlyphs) {
    const startX = charMarginPx + glyph.x;
    const endX = startX + glyph.advance;
    drawn.push(startX >= xMarginBeginPx && endX <= xMarginEndPx);
    if (endX >= xMarginEndPx) break;
  }
  return drawn;
}

/**
 * Groups one wrapped row's glyphs into same-colour runs, one `<TextRun>` each. `spans` covers
 * the whole buffer line, and `rowStartIndex` is this row's offset (`textEditRowStartIndices`). A glyph
 * `isDrawn` marks false, or one past its end, is left out but keeps its index for the colour lookup.
 * No highlighter, or an empty row, yields one `fallbackColor` run, so every row renders a `<TextRun>`.
 */
export function textEditRowColorRuns(
  rowGlyphs: readonly GlyphPlacement[],
  rowStartIndex: number,
  spans: readonly CodeHighlighterColorSpan[] | undefined,
  fallbackColor: Rgba,
  isDrawn?: readonly boolean[]
): TextEditGlyphColorRun[] {
  const runs: TextEditGlyphColorRun[] = [];
  let current: TextEditGlyphColorRun | undefined;
  rowGlyphs.forEach((glyph, k) => {
    if (isDrawn && !isDrawn[k]) return;
    const color = spans
      ? colorAt(spans, textEditGlyphLineIndex(glyph, rowStartIndex, k), fallbackColor)
      : fallbackColor;
    if (current && sameColor(current.color, color)) {
      current.glyphs.push(glyph);
    } else {
      current = { glyphs: [glyph], color };
      runs.push(current);
    }
  });
  return runs.length > 0 ? runs : [{ glyphs: [], color: fallbackColor }];
}

/** One colour run's glyphs as a `TextLineLayout`, `soloLineLayout`'s input, so a run renders through the same `<TextRun>` path as a whole row. */
export function textEditColorRunLine(run: TextEditGlyphColorRun): TextLineLayout {
  const first = run.glyphs[0];
  const last = run.glyphs[run.glyphs.length - 1];
  const widthPx = first && last ? last.x + last.advance - first.x : 0;
  return {
    text: run.glyphs.map((glyph) => glyph.char).join(''),
    glyphs: run.glyphs,
    widthPx,
    paragraphIndex: 0,
  };
}
