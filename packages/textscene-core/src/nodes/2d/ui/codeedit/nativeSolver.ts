/**
 * CodeEdit's native (WebGL canvas) rect solver. `get_minimum_size` is TextEdit's (`code_edit.h`
 * declares no override), so this adds CodeEdit's gutter band to `../textedit/nativeSolver.ts` through
 * `gutterBandWidthPx`. The constructor adds three gutters in this order (`code_edit.cpp:3928-3949`),
 * each drawn only on a line's first wrapped row (`text_edit.cpp:1410-1481`):
 *
 *  1. `main_gutter`, drawn for any of the bookmark, breakpoint or executing-line flags
 *     (`code_edit.cpp:1335-1337`), width `get_line_height()` (`code_edit.cpp:57`). Its icons need
 *     per-line metadata only a script sets, so its column is reserved but blank.
 *  2. `line_numbers`, drawn for `gutters_draw_line_numbers`, width
 *     `(line_number_digits + 1) * font->get_char_size('0', font_size).width` (`:1607`).
 *  3. `fold_gutter`, drawn for `gutters_draw_fold_gutter`, width `get_line_height() / 1.2` (`:59`),
 *     whose arrows `lineFolding.ts` decides.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { MinimumSizeFn, SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import {
  pickTextEditStyleBox,
  resolveTextEditStyleState,
  textEditTextTheme,
  textEditRowHeightPx,
  textEditMinimumSizeWith,
  TEXT_EDIT_THEME_FONT_KEY,
} from '../textedit/nativeSolver';
import { resolveNodeFontMetrics } from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { ControlColor } from '../control/types';
import type { CodeEditProperties } from './types';

/** `default_theme.cpp:526`: `Color(0.67, 0.67, 0.67, 0.4)`, distinct from `font_color`. */
export const CODE_EDIT_LINE_NUMBER_COLOR: ControlColor = { r: 0.67, g: 0.67, b: 0.67, a: 0.4 };

/** `line_numbers_min_digits`'s own default (`code_edit.h:114`). */
export const CODE_EDIT_LINE_NUMBERS_MIN_DIGITS_DEFAULT = 3;

/** `line_number_padding`'s default: a space, not zero (`code_edit.h:115`). */
const SPACE_PAD = ' ';
const ZERO_PAD = '0';

/**
 * `CodeEdit::_text_changed` (`code_edit.cpp:3875`): `MAX(line_numbers_min_digits, std::log10(lc) + 1)`,
 * transcribed with `Math.log10`'s float hazard at a power of ten, which `std::log10` shares, and not
 * replaced with `String(lc).length`.
 */
export function codeEditLineNumberDigits(lineCount: number, minDigits: number | undefined): number {
  const min = minDigits ?? CODE_EDIT_LINE_NUMBERS_MIN_DIGITS_DEFAULT;
  return Math.max(min, Math.floor(Math.log10(lineCount)) + 1);
}

/** `String::num_int64(line + 1).lpad(digits, padding)` (`code_edit.cpp:1569`). */
export function codeEditLineNumberText(lineIndex: number, digits: number, zeroPad: boolean | undefined): string {
  return String(lineIndex + 1).padStart(digits, zeroPad ? ZERO_PAD : SPACE_PAD);
}

export interface CodeEditGutterBand {
  mainDrawn: boolean;
  mainWidthPx: number;
  lineNumbersDrawn: boolean;
  lineNumberWidthPx: number;
  lineNumberDigits: number;
  foldDrawn: boolean;
  foldWidthPx: number;
  /** `gutters_width + gutter_padding`, for `../textedit/nativeSolver.ts`'s functions. */
  totalWidthPx: number;
}

/** Every gutter's own drawn state and width, plus the combined band `TextEdit`'s shared solver functions need. */
export function codeEditGutterBand(
  props: CodeEditProperties,
  rowHeightPx: number,
  charWidth0Px: number,
  lineCount: number
): CodeEditGutterBand {
  const mainDrawn = Boolean(props.gutterDrawBookmarks || props.gutterDrawBreakpoints || props.gutterDrawExecutingLines);
  const mainWidthPx = mainDrawn ? rowHeightPx : 0;

  const lineNumbersDrawn = props.gutterDrawLineNumbers === true;
  const lineNumberDigits = codeEditLineNumberDigits(lineCount, props.gutterLineNumbersMinDigits);
  const lineNumberWidthPx = lineNumbersDrawn ? (lineNumberDigits + 1) * charWidth0Px : 0;

  const foldDrawn = props.gutterDrawFoldGutter === true;
  const foldWidthPx = foldDrawn ? rowHeightPx / 1.2 : 0;

  const gutteredWidthPx = mainWidthPx + lineNumberWidthPx + foldWidthPx;
  // `_update_gutter_width` (`text_edit.cpp:8962-8977`) sets `gutter_padding = 2` and never clears it.
  // `GutterInfo::draw` defaults true (`text_edit.h:129`) and `add_gutter` updates at once (`:6709-6718`),
  // so each constructor gutter latches the padding before `set_gutter_draw(idx, false)`
  // (`code_edit.cpp:3931-3953`). Every CodeEdit carries the 2px.
  const gutterPaddingPx = 2;

  return {
    mainDrawn,
    mainWidthPx,
    lineNumbersDrawn,
    lineNumberWidthPx,
    lineNumberDigits,
    foldDrawn,
    foldWidthPx,
    totalWidthPx: gutteredWidthPx + gutterPaddingPx,
  };
}

/** This node's row height and a '0' glyph's advance: the two font-derived inputs `codeEditGutterBand` needs. */
function codeEditFontMetrics(
  n: SolveNode,
  ctx: SolveContext,
  props: CodeEditProperties
): { rowHeightPx: number; charWidth0Px: number } {
  const state = resolveTextEditStyleState(props.editable);
  const { fontSizePx } = textEditTextTheme(n, props, state, ctx);
  const fontMetrics = resolveNodeFontMetrics(n, TEXT_EDIT_THEME_FONT_KEY);
  const rowHeightPx = textEditRowHeightPx(fontMetrics, fontSizePx, ctx.theme.separation);
  const charWidth0Px = ctx.measureText ? ctx.measureText('0', fontSizePx, 0, fontMetrics).x : 0;
  return { rowHeightPx, charWidth0Px };
}

/**
 * The line-numbers gutter's left edge: `gutter_offset` accumulated over the drawn gutters before it
 * (`text_edit.cpp:1417-1481`). In CodeEdit's fixed order (`code_edit.cpp:3928-3949`) only the main
 * gutter can precede it.
 */
export function codeEditLineNumberGutterXPx(styleLeftMarginPx: number, mainWidthPx: number): number {
  return Math.ceil(styleLeftMarginPx) + mainWidthPx;
}

/** The fold gutter's left edge: the same accumulation, with the main and line-number gutters ahead of it. */
export function codeEditFoldGutterXPx(
  styleLeftMarginPx: number,
  mainWidthPx: number,
  lineNumberWidthPx: number
): number {
  return Math.ceil(styleLeftMarginPx) + mainWidthPx + lineNumberWidthPx;
}

/**
 * Where the line number draws. RTL flips both steps: the gutter region mirrors about the control
 * (`text_edit.cpp:1471-1476`), and `_line_number_draw_callback` right-aligns inside it
 * (`code_edit.cpp:1583-1587`). `textWidthPx` is measured as `shaped_text_get_size` reports it.
 */
export function codeEditLineNumberTextXPx(
  gutterXPx: number,
  gutterWidthPx: number,
  rectWidthPx: number,
  textWidthPx: number,
  rtl: boolean
): number {
  if (!rtl) return gutterXPx;
  const regionXPx = rectWidthPx - gutterXPx - gutterWidthPx;
  return regionXPx + gutterWidthPx - shapedTextSizeWidthPx(textWidthPx);
}

/**
 * `_line_number_draw_callback`'s vertical centring (`code_edit.cpp:1580-1582`): the region centre
 * minus half the text size, plus the ascent. `ofs.y - ascent` is the shaped text's box top, which
 * `<TextRun>` anchors from, so the ascent cancels.
 */
export function codeEditGutterCellTextTopPx(rowTopPx: number, rowHeightPx: number, textHeightPx: number): number {
  return rowTopPx + (rowHeightPx - textHeightPx) / 2;
}

/** `CodeEdit::get_minimum_size`: TextEdit's, with this node's gutter band folded in. */
export const codeEditMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as CodeEditProperties;
  const state = resolveTextEditStyleState(props.editable);
  const styleBox = pickTextEditStyleBox(n.styleBoxes, ctx.theme.widgets.lineEdit, state);
  const { rowHeightPx, charWidth0Px } = codeEditFontMetrics(n, ctx, props);
  const lineCount = Math.max(1, (props.text ?? '').split('\n').length);
  const band = codeEditGutterBand(props, rowHeightPx, charWidth0Px, lineCount);
  return textEditMinimumSizeWith(n, ctx, props, styleBox, band.totalWidthPx, props.indentSize);
};


/** `code_folding_color` = `Color(0.8, 0.8, 0.8, 0.8)` (`default_theme.cpp:524`), the fold arrow's modulate. */
export const CODE_EDIT_CODE_FOLDING_COLOR: ControlColor = { r: 0.8, g: 0.8, b: 0.8, a: 0.8 };

/** `folded_code_region_color` = `Color(0.68, 0.46, 0.77, 0.2)` (`default_theme.cpp:525`), with the alpha floored at 0.4 the way `_fold_gutter_draw_callback` floors it (`code_edit.cpp:1636-1637`). */
export const CODE_EDIT_CODE_REGION_ICON_COLOR: ControlColor = { r: 0.68, g: 0.46, b: 0.77, a: 0.4 };

/**
 * The icon rect inside one fold-gutter cell, after `_fold_gutter_draw_callback`'s padding
 * (`code_edit.cpp:1628-1632`): a tenth of the width off each side, a sixth of the height off top and bottom.
 */
export function codeEditFoldIconRect(cell: Rect2): Rect2 {
  const horizontal = Math.trunc(cell.w / 10);
  const vertical = Math.trunc(cell.h / 6);
  return {
    x: cell.x + horizontal,
    y: cell.y + vertical,
    w: cell.w - horizontal * 2,
    h: cell.h - vertical * 2,
  };
}

/** `line_length_guideline_color` = `Color(0.3, 0.5, 0.8, 0.1)` (`default_theme.cpp:531`). */
export const CODE_EDIT_LINE_LENGTH_GUIDELINE_COLOR: ControlColor = { r: 0.3, g: 0.5, b: 0.8, a: 0.1 };

/** One drawn `line_length_guidelines` rule. */
export interface CodeEditGuideline {
  /** This rule's own x in the control's local space, already mirrored under RTL. */
  xPx: number;
  /** `i === 0` keeps the full `line_length_guideline_color`, and every later one is multiplied by `Color(1, 1, 1, 0.5)` (`code_edit.cpp:305`). */
  dimmed: boolean;
}

/**
 * `CodeEdit::_draw_guidelines` (`code_edit.cpp:288-313`): a hairline at `xmargin_beg + column_pos` for
 * each authored column, drawn only strictly inside the margins, so column 0 draws nothing. The dim rule
 * reads the authored index. The caller measures `columnWidthPx` with the node's font, so a font-metric
 * change cannot read as a placement change here.
 */
export function codeEditGuidelines(
  columns: readonly number[],
  columnWidthPx: (column: number) => number,
  xMarginBeginPx: number,
  xMarginEndPx: number,
  rectWidthPx: number,
  rtl: boolean
): CodeEditGuideline[] {
  const out: CodeEditGuideline[] = [];
  columns.forEach((column, i) => {
    // `const int column_pos = …` truncates the already-ceiled shaped extent.
    const xoffset = xMarginBeginPx + shapedTextSizeWidthPx(columnWidthPx(column));
    // `get_h_scroll()` is 0 (`../textedit/nativeSolver.ts`'s SCROLL IS INERT doc).
    if (xoffset <= xMarginBeginPx || xoffset >= xMarginEndPx) return;
    // The lit pixel is `xoffset - 1`: a zero-width line is a two-point primitive
    // (`renderer_canvas_cull.cpp:754-762`), and a vertical one on a pixel boundary lights the
    // pixel on the left. Measured on eight columns under both `--rendering-driver` arms.
    out.push({ xPx: (rtl ? rectWidthPx - xoffset : xoffset) - 1, dimmed: i !== 0 });
  });
  return out;
}
