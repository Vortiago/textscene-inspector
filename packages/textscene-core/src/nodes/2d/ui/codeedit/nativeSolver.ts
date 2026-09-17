/**
 * CodeEdit's native (WebGL canvas) rect solver — `CodeEdit::get_minimum_size`
 * is TextEdit's UNCHANGED (`code_edit.h` declares no override), so this
 * module's only job is CodeEdit's own gutter geometry
 * (`CodeEdit::CodeEdit()`'s constructor, `code_edit.cpp:3928-3949`, and each
 * gutter's own width setter) and folding that into `../textedit/nativeSolver.ts`'s
 * shared functions via their `gutterBandWidthPx` parameter.
 *
 * Three gutters, added in this fixed order (`code_edit.cpp:3928-3949`), each
 * drawn only on a buffer line's FIRST wrapped row
 * (`text_edit.cpp:1410-1481`'s `if (line_wrap_index == 0)`):
 *
 *  1. `main_gutter` — bookmark/breakpoint/executing-line icons. Drawn iff
 *     `gutters_draw_bookmarks || gutters_draw_breakpoints_gutter ||
 *     gutters_draw_executing_lines` (`_update_draw_main_gutter`,
 *     `code_edit.cpp:1335-1337`); width `get_line_height()`
 *     (`code_edit.cpp:57`). Every one of those three icons is keyed to
 *     PER-LINE metadata (`set_line_as_bookmarked`/`breakpointed`/`executing`)
 *     set only from script — no `.tscn` can carry it — so this gutter's own
 *     column is reserved but drawn BLANK.
 *  2. `line_numbers` — width `(line_number_digits + 1) *
 *     font->get_char_size('0', font_size).width` (`:1607`); drawn iff
 *     `gutters_draw_line_numbers`. The one gutter this previewer actually
 *     paints — `Component.tsx`.
 *  3. `fold_gutter` — width `get_line_height() / 1.2` (`:59`); drawn iff
 *     `gutters_draw_fold_gutter`. `can_fold_line` (`:1662-`) depends on
 *     indentation/delimiter/comment analysis this previewer does not
 *     perform, so — like the main gutter — this column is reserved but
 *     drawn BLANK; `comparison.md` records the gap.
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
import type { ControlColor } from '../control/types';
import type { CodeEditProperties } from './types';

/** `default_theme.cpp:526`: `Color(0.67, 0.67, 0.67, 0.4)` — distinct from `font_color`. */
export const CODE_EDIT_LINE_NUMBER_COLOR: ControlColor = { r: 0.67, g: 0.67, b: 0.67, a: 0.4 };

/** `line_numbers_min_digits`'s own default (`code_edit.h:114`). */
export const CODE_EDIT_LINE_NUMBERS_MIN_DIGITS_DEFAULT = 3;

/** `line_number_padding`'s own default — a space, not zero (`code_edit.h:115`). */
const SPACE_PAD = ' ';
const ZERO_PAD = '0';

/**
 * `CodeEdit::_text_changed` (`code_edit.cpp:3875`):
 *
 *     int new_line_number_digits = MAX(line_numbers_min_digits, std::log10(lc) + 1);
 *
 * Transcribed exactly, including `Math.log10`'s own float-precision hazard at
 * an exact power of ten (Godot's own `std::log10` carries the identical
 * hazard) — never replaced with a nicer `String(lc).length`.
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
  /** `gutters_width + gutter_padding` combined — feed straight to `../textedit/nativeSolver.ts`'s functions. */
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
  // text_edit.cpp:8969-8971 — padding appears only once ANY gutter is drawn.
  const gutterPaddingPx = gutteredWidthPx > 0 ? 2 : 0;

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

/** This node's own row height plus a '0' glyph's advance — the two font-derived inputs `codeEditGutterBand` needs. */
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
 * The line-numbers gutter's own LEFT edge — `gutter_offset` accumulated
 * through the drawn gutters preceding it in `gutters` array order
 * (`text_edit.cpp:1417-1481`'s loop: `gutter_offset = left_margin; … if
 * (gutter.draw) gutter_offset += gutter.width;`), restricted to this slice's
 * fixed gutter order (main, then line numbers, then fold —
 * `CodeEdit::CodeEdit()`, `code_edit.cpp:3928-3949`): only the MAIN gutter's
 * width can precede it.
 */
export function codeEditLineNumberGutterXPx(styleLeftMarginPx: number, mainWidthPx: number): number {
  return Math.ceil(styleLeftMarginPx) + mainWidthPx;
}

/**
 * Where the line number itself draws. Two steps, both of which RTL flips: the
 * gutter's own region mirrors about the control before the CUSTOM callback
 * ever sees it (`text_edit.cpp:1471-1476`), and
 * `_line_number_draw_callback` then right-aligns the number inside that region
 * instead of left-aligning it (`code_edit.cpp:1583-1587`). `textWidthPx` is
 * measured the way `shaped_text_get_size` reports it.
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
 * `_line_number_draw_callback`'s own vertical centring (`code_edit.cpp:1580-1582`):
 *
 *     Point2 ofs = p_region.get_center() - text_size / 2;
 *     ofs.y += TS->shaped_text_get_ascent(text_rid);
 *
 * `p_region`'s own top is `rowTopPx`, height `rowHeightPx` — `ofs.y - ascent`
 * is therefore the shaped text's own BOX TOP, which is what `<TextRun>`
 * anchors a line from (`buildGlyphQuadArrays`'s own doc), so the ascent term
 * cancels here rather than needing to be threaded through.
 */
export function codeEditGutterCellTextTopPx(rowTopPx: number, rowHeightPx: number, textHeightPx: number): number {
  return rowTopPx + (rowHeightPx - textHeightPx) / 2;
}

/** `CodeEdit::get_minimum_size` — TextEdit's own, with this node's OWN gutter band folded in. */
export const codeEditMinimumSize: MinimumSizeFn = (n, ctx) => {
  const props = n.node.properties as CodeEditProperties;
  const state = resolveTextEditStyleState(props.editable);
  const styleBox = pickTextEditStyleBox(n.styleBoxes, ctx.theme.widgets.lineEdit, state);
  const { rowHeightPx, charWidth0Px } = codeEditFontMetrics(n, ctx, props);
  const lineCount = Math.max(1, (props.text ?? '').split('\n').length);
  const band = codeEditGutterBand(props, rowHeightPx, charWidth0Px, lineCount);
  return textEditMinimumSizeWith(n, ctx, props, styleBox, band.totalWidthPx, props.indentSize);
};
