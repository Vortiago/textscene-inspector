/**
 * The minimap of a TextEdit or CodeEdit, as a still frame: the minimap arm of
 * `TextEdit::_notification(NOTIFICATION_DRAW)` (`scene/gui/text_edit.cpp:1129-1312`) from line 0 at
 * scroll 0. It returns the rects Godot adds, in draw order, in the control's pixels with +Y down.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { Rect2 } from '../../../../godot/math/rect2';
import type { Rgba } from '../../../../godot/math/math';
import type { CodeHighlighterColorSpan } from '../../../../resources/styles/codehighlighter/highlight';
import {
  textEditFirstIndentRow,
  textEditRowStartIndices,
  textEditRowStats,
  type TextEditLineLayout,
} from './nativeSolver';

/** `minimap_char_size` is (1, 2) and `minimap_line_spacing` 1 (`text_edit.h:576-577`). */
const CHAR_WIDTH_PX = 1;
const CHAR_HEIGHT_PX = 2;
const ROW_PITCH_PX = 3;
/** The minimap starts this far past the text band (`:1162`). */
const BAND_GAP_PX = 2;
/** A highlighted colour is drawn at this fraction of its alpha (`:1261`). */
const HIGHLIGHT_ALPHA_SCALE = 0.6;
/** The view rectangle takes the caret colour at this alpha when neither hovered nor dragged (`:1158`). */
const VIEW_RECT_ALPHA = 0.1;
/** The share of the minimap width a wrapped row's indent may take (`:1204`). */
const WRAP_INDENT_WIDTH_SHARE = 0.6;

interface TextEditMinimapLine {
  text: string;
  /** Where each wrapped row starts in `text`. */
  rowStarts: readonly number[];
  /** The highlighter's colours for the whole line, or `undefined` without a highlighter. */
  spans: readonly CodeHighlighterColorSpan[] | undefined;
}

interface TextEditMinimapInput {
  /** The buffer's lines: a placeholder is one empty line, as the buffer holds it. */
  lines: readonly TextEditMinimapLine[];
  sizeWidthPx: number;
  /** `xmargin_end`, which already excludes the minimap (`:941-944`). */
  xMarginEndPx: number;
  /** `minimap_width`. */
  widthPx: number;
  rtl: boolean;
  /** `_get_control_height()` (`:8658-8664`). */
  controlHeightPx: number;
  rowHeightPx: number;
  /** The rows the first drawn paragraph shapes: the placeholder's, or line 0's (`:1127`). */
  firstDrawnParagraphRows: number;
  /** `wrap_at_column`. */
  wrapWidthPx: number;
  tabSize: number;
  indentWrappedLines: boolean;
  highlightCurrentLine: boolean;
  editable: boolean;
  /** `font_color`, or `font_readonly_color` when `!editable`. */
  fontColor: Rgba;
  /** `caret_color`: the view rectangle's colour. */
  caretColor: Rgba;
  currentLineColor: Rgba;
}

/**
 * The buffer's lines as the minimap reads them, and the rows the first drawn paragraph shapes
 * (`:1127`). A placeholder is drawn as its own paragraph but the buffer holds one empty line.
 */
export function textEditMinimapLines(
  lines: readonly string[],
  lineLayouts: readonly TextEditLineLayout[],
  lineColorSpans: readonly (readonly CodeHighlighterColorSpan[])[] | null,
  isPlaceholder: boolean
): { lines: TextEditMinimapLine[]; firstDrawnParagraphRows: number } {
  if (isPlaceholder) {
    return {
      lines: [{ text: '', rowStarts: [0], spans: undefined }],
      firstDrawnParagraphRows: textEditRowStats(lineLayouts).totalRows,
    };
  }
  return {
    lines: lines.map((text, index) => ({
      text,
      rowStarts: textEditRowStartIndices(text, lineLayouts[index]?.layout.lines ?? []),
      spans: lineColorSpans?.[index],
    })),
    firstDrawnParagraphRows: lineLayouts[0]?.layout.lines.length ?? 1,
  };
}

export interface TextEditMinimapRect extends Rect2 {
  color: Rgba;
}

/** `is_whitespace` (`core/string/char_utils.h:121-123`). */
function isWhitespace(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return (
    code === 0x20 ||
    code === 0xa0 ||
    code === 0x1680 ||
    (code >= 0x2000 && code <= 0x200b) ||
    code === 0x202f ||
    code === 0x205f ||
    code === 0x3000 ||
    code === 0x2028 ||
    code === 0x2029 ||
    (code >= 0x09 && code <= 0x0d) ||
    code === 0x85
  );
}

function sameColor(a: Rgba, b: Rgba): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

/** `_get_wrapped_indent_level` (`:4107-4131`): tabs by `tab_size` plus spaces, on the first row the indent does not span. */
function wrappedIndentColumns(
  { text, rowStarts }: TextEditMinimapLine,
  tabSize: number
): { columns: number; firstFlushRow: number } {
  const firstFlushRow = textEditFirstIndentRow(text, rowStarts);
  let tabs = 0;
  let spaces = 0;
  for (let i = rowStarts[firstFlushRow] ?? 0; i < text.length - 1; i++) {
    if (text[i] === '\t') tabs++;
    else if (text[i] === ' ') spaces++;
    else break;
  }
  return { columns: tabs * tabSize + spaces, firstFlushRow };
}

/** The colour of the last highlighter entry at or before `index`, dimmed (`:1255-1262`), or `undefined` where none applies. */
function highlightedColorAt(
  spans: readonly CodeHighlighterColorSpan[] | undefined,
  index: number,
  fontColor: Rgba,
  editable: boolean
): Rgba | undefined {
  const span = spans?.find((candidate) => index >= candidate.startIndex && index < candidate.endIndex);
  if (!span) return undefined;
  const alpha = editable ? span.color.a : fontColor.a;
  return { ...span.color, a: alpha * HIGHLIGHT_ALPHA_SCALE };
}

interface RowBars {
  rects: TextEditMinimapRect[];
  /** The colour the row ends on: the next row of the same line starts from it (`:1194`, `:1241`). */
  endColor: Rgba;
}

/**
 * One wrapped row's bars (`:1241-1311`): a run of characters of one colour is one bar, a space is one
 * blank column and a tab runs to the next tab stop.
 */
function rowBars(
  line: TextEditMinimapLine,
  rowIndex: number,
  startColor: Rgba,
  startXPx: number,
  slot: number,
  input: TextEditMinimapInput
): RowBars {
  const { sizeWidthPx, xMarginEndPx, widthPx, rtl, tabSize } = input;
  const bandEndPx = xMarginEndPx + widthPx;
  const rowStart = line.rowStarts[rowIndex] ?? 0;
  const row = line.text.slice(rowStart, line.rowStarts[rowIndex + 1] ?? line.text.length);
  const rects: TextEditMinimapRect[] = [];
  let current = startColor;
  let nextColor = startColor;
  let tabAlignment = 0;
  let x = startXPx;
  for (let j = 0; j < row.length; j++) {
    let characters = 0;
    let nextIsWhitespace = false;
    let nextIsTab = false;
    for (; j + characters < row.length; characters++) {
      const index = j + characters;
      nextColor =
        highlightedColorAt(line.spans, rowStart + index, input.fontColor, input.editable) ?? nextColor;
      if (characters === 0) current = nextColor;
      if (!sameColor(nextColor, current)) break;
      nextIsWhitespace = isWhitespace(row[index]!);
      if (nextIsWhitespace) {
        nextIsTab = row[index] === '\t';
        break;
      }
      if (x + CHAR_WIDTH_PX * characters >= bandEndPx) break;
    }
    if (!nextIsWhitespace && characters === 0) break;
    if (characters > 0) {
      const w = CHAR_WIDTH_PX * characters;
      rects.push({
        x: rtl ? sizeWidthPx - x - w : x,
        y: slot * ROW_PITCH_PX,
        w,
        h: CHAR_HEIGHT_PX,
        color: current,
      });
    }
    j += characters - 1;
    x += CHAR_WIDTH_PX * characters;
    tabAlignment += characters;
    if (nextIsWhitespace) {
      if (nextIsTab) {
        tabAlignment %= tabSize;
        x += CHAR_WIDTH_PX * (tabSize - tabAlignment);
        tabAlignment = 0;
      } else {
        x += CHAR_WIDTH_PX;
        tabAlignment += 1;
      }
      j += 1;
    }
    if (x >= bandEndPx) break;
  }
  return { rects, endColor: current };
}

/** `wrap_indent_line`, then `indent_px` (`:1203-1219`): the columns a wrapped row steps in, or 0. */
function wrapIndentColumns(line: TextEditMinimapLine, rowIndex: number, input: TextEditMinimapInput): number {
  if (!input.indentWrappedLines) return 0;
  const { columns, firstFlushRow } = wrappedIndentColumns(line, input.tabSize);
  if (rowIndex <= firstFlushRow) return 0;
  const indent = Math.trunc(Math.min(columns, (input.widthPx / CHAR_WIDTH_PX) * WRAP_INDENT_WIDTH_SHARE));
  return indent >= input.wrapWidthPx ? 0 : indent;
}

export function textEditMinimapRects(input: TextEditMinimapInput): TextEditMinimapRect[] {
  const { sizeWidthPx, xMarginEndPx, widthPx, rtl } = input;
  const bandLeftPx = rtl ? sizeWidthPx - (xMarginEndPx + BAND_GAP_PX) - widthPx : xMarginEndPx + BAND_GAP_PX;
  const visibleSlots = Math.trunc(input.controlHeightPx / ROW_PITCH_PX);
  const firstLineRows = input.lines[0]?.rowStarts.length ?? 1;
  const slotCount = visibleSlots + firstLineRows - 1;
  const visibleRows = Math.trunc(input.controlHeightPx / input.rowHeightPx);

  // The view rectangle's offset is 0 at scroll 0 (`:1138`).
  const rects: TextEditMinimapRect[] = [
    {
      x: bandLeftPx,
      y: 0,
      w: widthPx,
      h: (visibleRows + input.firstDrawnParagraphRows) * ROW_PITCH_PX,
      color: { ...input.caretColor, a: VIEW_RECT_ALPHA },
    },
  ];

  for (let lineIndex = 0, slot = 0; slot < slotCount && lineIndex < input.lines.length; lineIndex++, slot++) {
    const line = input.lines[lineIndex]!;
    let color = input.fontColor;
    for (let rowIndex = 0; rowIndex < line.rowStarts.length; rowIndex++) {
      if (rowIndex !== 0) {
        slot++;
        if (slot >= slotCount) break;
      }
      if (input.highlightCurrentLine && lineIndex === 0 && rowIndex === 0) {
        rects.push({
          x: bandLeftPx,
          y: slot * ROW_PITCH_PX,
          w: widthPx,
          h: CHAR_HEIGHT_PX,
          color: input.currentLineColor,
        });
      }
      const startXPx = xMarginEndPx + BAND_GAP_PX + wrapIndentColumns(line, rowIndex, input) * CHAR_WIDTH_PX;
      const bars = rowBars(line, rowIndex, color, startXPx, slot, input);
      rects.push(...bars.rects);
      color = bars.endColor;
    }
  }
  return rects;
}
