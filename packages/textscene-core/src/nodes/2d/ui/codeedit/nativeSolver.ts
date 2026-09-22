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
import type { Rect2 } from '../../../../r3f/controls/native/rect';
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
  // `_update_gutter_width` (`text_edit.cpp:8962-8977`) only ever SETS
  // `gutter_padding = 2`; there is no branch that clears it. `GutterInfo::draw`
  // defaults TRUE (`text_edit.h:129`) and `add_gutter` runs that update
  // immediately (`:6709-6718`), so each of CodeEdit's three constructor gutters
  // latches the padding on before `set_gutter_draw(idx, false)` turns the
  // gutter itself off (`code_edit.cpp:3931-3953`). Every CodeEdit therefore
  // carries the 2px, drawn gutters or not.
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

/** The FOLD gutter's own left edge — the same accumulation, with the main and line-number gutters ahead of it. */
export function codeEditFoldGutterXPx(
  styleLeftMarginPx: number,
  mainWidthPx: number,
  lineNumberWidthPx: number
): number {
  return Math.ceil(styleLeftMarginPx) + mainWidthPx + lineNumberWidthPx;
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


/** `code_folding_color` = `Color(0.8, 0.8, 0.8, 0.8)` (`default_theme.cpp:524`) — the fold arrow's own modulate. */
export const CODE_EDIT_CODE_FOLDING_COLOR: ControlColor = { r: 0.8, g: 0.8, b: 0.8, a: 0.8 };

/** `folded_code_region_color` = `Color(0.68, 0.46, 0.77, 0.2)` (`default_theme.cpp:525`), with the alpha floored at 0.4 the way `_fold_gutter_draw_callback` floors it (`code_edit.cpp:1636-1637`). */
export const CODE_EDIT_CODE_REGION_ICON_COLOR: ControlColor = { r: 0.68, g: 0.46, b: 0.77, a: 0.4 };

/**
 * The icon rect inside one fold-gutter cell — `_fold_gutter_draw_callback`'s
 * own padding (`code_edit.cpp:1628-1632`): a tenth of the cell's width off each
 * side, a sixth of its height off top and bottom.
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
  /** `i === 0` keeps the full `line_length_guideline_color`; every later one is multiplied by `Color(1, 1, 1, 0.5)` (`code_edit.cpp:305`). */
  dimmed: boolean;
}

/**
 * `CodeEdit::_draw_guidelines` (`code_edit.cpp:288-313`): a hairline down the
 * whole control at each authored column.
 *
 *     column_pos = font->get_string_size(String("0").repeat(column)).x
 *     xoffset    = xmargin_beg + column_pos - get_h_scroll()
 *     if (xoffset > xmargin_beg && xoffset < xmargin_end) draw
 *
 * Both bounds are STRICT: column 0 measures 0 and so lands exactly on
 * `xmargin_beg`, which draws nothing. `get_h_scroll()` is 0 here
 * (`../textedit/nativeSolver.ts`'s SCROLL IS INERT doc).
 *
 * The dim rule reads the AUTHORED index, so dropping an out-of-band column
 * does not promote the next one to "first".
 *
 * `xPx` is the pixel column the line actually LIGHTS, which is `xoffset - 1`.
 * A zero-width `canvas_item_add_line` emits a two-point PRIMITIVE
 * (`renderer_canvas_cull.cpp:754-762`), rasterised as a GL line; a vertical
 * one at an integer x falls exactly on a pixel boundary, and this engine
 * resolves that tie toward the pixel on the LEFT. Measured on eight columns
 * under BOTH `--rendering-driver` arms, which is what separates it from the
 * driver-dependent blend rounding.
 *
 * `columnWidthPx` is handed in rather than measured here: the caller owns the
 * node's resolved font, and passing the measurement keeps a font-metric change
 * from reading as a placement change in this function's own tests.
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
    if (xoffset <= xMarginBeginPx || xoffset >= xMarginEndPx) return;
    out.push({ xPx: (rtl ? rectWidthPx - xoffset : xoffset) - 1, dimmed: i !== 0 });
  });
  return out;
}
