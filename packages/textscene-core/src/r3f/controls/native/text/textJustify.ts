/**
 * Line justification, a port of `TextServer::shaped_text_fit_to_width`
 * (`modules/text_server_adv/text_server_adv.cpp:5531-5686`) scoped to what a font with no kashida
 * elongation glyphs reaches. It walks a line's glyphs in visual order, as `sd->glyphs` holds them
 * after `_shape_substr` (`:5350-5420`). It ports `WORD_BOUND`, `TRIM_EDGE_SPACES` and
 * `AFTER_LAST_TAB`. Without `TRIM_EDGE_SPACES` it skips the break spaces at the ends of a line, as
 * `shaped_text_fit_to_width` does. The other flags do nothing here:
 * - `KASHIDA` fires only on elongation glyphs (Arabic tatweel runs), which the Latin shaper never tags.
 * - `CONSTRAIN_ELLIPSIS` is `fitTrimmedGlyphsToWidth`, which the overrun trim of a filled Label line calls.
 * - The `SKIP_LAST_LINE` flags and `DO_NOT_SKIP_SINGLE_LINE` decide which lines a caller fits at all,
 *   so they are the caller's business, and `justifyToLineIndex` answers it for one paragraph.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import {
  isTabChar,
  isWhitespace,
  shapedTextSizeWidthPx,
  startsParagraph,
  type GlyphPlacement,
  type TextLineLayout,
} from './textLayout';
import { JustificationFlag } from '../../../../godot/text/textServerEnums';
import type { EnumValue } from '../../../../godot/classdb/enumNames.js';

/**
 * Whether glyph `i` carries `GRAPHEME_IS_BREAK_SOFT`: a space after which a break may fall
 * (`text_server_adv.cpp:6396-6400`). Only the last space of a run does, and a line ends at one.
 */
function isBreakSpace(glyphs: readonly GlyphPlacement[], i: number): boolean {
  if (!isWhitespace(glyphs[i]!.char.codePointAt(0)!)) return false;
  const next = glyphs[i + 1];
  return next === undefined || !isWhitespace(next.char.codePointAt(0)!);
}

interface FitLineOptions {
  fontSizePx: number;
  /**
   * `JUSTIFICATION_CONSTRAIN_ELLIPSIS` (`:5573-5583`): the glyph index the overrun trim cut at.
   * The fit then spans the glyphs from the start to it, or from it to the end on an RTL line.
   */
  trimPos?: number;
}

/**
 * Port of `TextServer::shaped_text_fit_to_width`, scoped per this module's own doc. The source's
 * `adv_remain` whole-pixel carry (`:5662-5671`) is not ported: `gl.advance = new_advance` runs
 * before `adv_remain += (new_advance - gl.advance)`, so the carry is always zero.
 */
function fitLineToWidth(
  line: TextLineLayout,
  widthPx: number,
  flags: EnumValue<typeof JustificationFlag>,
  options: FitLineOptions
): TextLineLayout {
  const glyphs = line.glyphs;
  if (glyphs.length === 0) return line;

  let startPos = 0;
  let endPos = glyphs.length - 1;

  // :5547-5570: the logically last tab is the visually last one, or the visually first on an RTL line.
  if (flags & JustificationFlag.AFTER_LAST_TAB) {
    if (line.isRtl) {
      const firstTab = glyphs.findIndex((glyph) => isTabChar(glyph.char));
      if (firstTab >= 0) endPos = firstTab;
    } else {
      for (let i = glyphs.length - 1; i >= 0; i--) {
        if (isTabChar(glyphs[i]!.char)) {
          startPos = i;
          break;
        }
      }
    }
  }

  if (options.trimPos !== undefined) {
    if (line.isRtl) startPos = options.trimPos;
    else endPos = options.trimPos;
  }

  let justificationWidthPx = line.widthPx;
  const zeroedAdvanceAt = new Set<number>();

  // :5588-5599 -- edge spaces contribute no width to what is being justified.
  if (flags & JustificationFlag.TRIM_EDGE_SPACES) {
    while (startPos < endPos && isWhitespace(glyphs[startPos]!.char.codePointAt(0)!)) {
      justificationWidthPx -= glyphs[startPos]!.advance;
      zeroedAdvanceAt.add(startPos);
      startPos += 1;
    }
    while (startPos < endPos && isWhitespace(glyphs[endPos]!.char.codePointAt(0)!)) {
      justificationWidthPx -= glyphs[endPos]!.advance;
      zeroedAdvanceAt.add(endPos);
      endPos -= 1;
    }
  }
  // :5601-5607, without TRIM_EDGE_SPACES: the edge break spaces keep their width and leave the space count.
  else {
    while (startPos < endPos && isBreakSpace(glyphs, startPos)) startPos += 1;
    while (startPos < endPos && isBreakSpace(glyphs, endPos)) endPos -= 1;
  }

  // :5610-5624 -- GRAPHEME_IS_SPACE, not punctuation; the vendored charset's
  // only such glyph is a literal space.
  let spaceCount = 0;
  for (let i = startPos; i <= endPos; i++) {
    if (glyphs[i]!.char === ' ') spaceCount++;
  }

  // :5648-5675
  const wordBound = (flags & JustificationFlag.WORD_BOUND) !== 0 && spaceCount > 0;
  const deltaPerSpacePx = wordBound ? (widthPx - justificationWidthPx) / spaceCount : 0;

  let cumulativeShiftPx = 0;
  const outGlyphs = glyphs.map((g, i) => {
    const x = g.x + cumulativeShiftPx;
    let advance = g.advance;
    if (zeroedAdvanceAt.has(i)) {
      advance = 0;
    } else if (wordBound && i >= startPos && i <= endPos && g.char === ' ') {
      // `0.1 * gl.font_size` (`:5659`): the run's own size, else the caller's.
      advance = Math.max(g.advance + deltaPerSpacePx, 0.1 * (g.fontSizePx ?? options.fontSizePx));
    }
    cumulativeShiftPx += advance - g.advance;
    return { ...g, x, advance };
  });

  return { ...line, glyphs: outGlyphs, widthPx: line.widthPx + cumulativeShiftPx };
}

/**
 * The glyphs of `line` fitted again to `widthPx` after the overrun trim cut at `trimPos`, with
 * `JUSTIFICATION_CONSTRAIN_ELLIPSIS` (`label.cpp:325`). `trimmedWidthPx` is the kept advance plus the
 * ellipsis (`width_trimmed`, `:5580`), which the spaces grow to fill up to `widthPx`.
 */
export function fitTrimmedGlyphsToWidth(
  line: TextLineLayout,
  trim: { trimPos: number; trimmedWidthPx: number },
  widthPx: number,
  flags: number,
  fontSizePx: number
): GlyphPlacement[] {
  const lineAtTrimmedWidth = { ...line, widthPx: trim.trimmedWidthPx };
  return fitLineToWidth(lineAtTrimmedWidth, widthPx, flags, { fontSizePx, trimPos: trim.trimPos }).glyphs;
}

/** `TS->shaped_text_has_visible_chars` reduced to this engine's charset: any glyph whose own character is not whitespace. */
function lineHasVisibleChars(line: TextLineLayout): boolean {
  return line.glyphs.some((g) => !isWhitespace(g.char.codePointAt(0)!));
}

/**
 * How many leading `lines` get justified: `jst_to_line` of Label for autowrap off (`label.cpp:304-319`)
 * and of TextMesh (`primitive_meshes.cpp:3284-3304`). Label's autowrap-on copy (`:273-289`) serves
 * `lines_hidden`, which this slice does not model.
 */
function justifyToLineIndex(lines: readonly TextLineLayout[], flags: number): number {
  if (lines.length === 1 && flags & JustificationFlag.DO_NOT_SKIP_SINGLE_LINE) return lines.length;
  let jstToLine = lines.length;
  if (flags & JustificationFlag.SKIP_LAST_LINE) jstToLine = lines.length - 1;
  if (flags & JustificationFlag.SKIP_LAST_LINE_WITH_VISIBLE_CHARS) {
    for (let i = lines.length - 1; i >= 0; i--) {
      if (lineHasVisibleChars(lines[i]!)) {
        jstToLine = i;
        break;
      }
    }
  }
  return jstToLine;
}

/** One paragraph's lines fitted to `widthPx`, by `justifyToLineIndex`'s count of lines to fit. */
function justifyParagraph(
  lines: readonly TextLineLayout[],
  widthPx: number,
  flags: number,
  fontSizePx: number
): TextLineLayout[] {
  const toLine = justifyToLineIndex(lines, flags);
  return lines.map((line, i) => (i < toLine ? fitLineToWidth(line, widthPx, flags, { fontSizePx }) : line));
}

/**
 * The justified lines of a box that carries its own `width`: TextMesh (`primitive_meshes.cpp:3284-3304`)
 * and Label3D (`label_3d.cpp:538-557`). Each fitted line grows or shrinks to `widthPx`, or to the
 * widest line when `widthPx` is zero or less.
 */
export function justifyLinesToWidth(
  lines: readonly TextLineLayout[],
  widthPx: number,
  flags: number,
  fontSizePx: number
): TextLineLayout[] {
  const fitWidthPx =
    widthPx > 0 ? widthPx : Math.max(0, ...lines.map((line) => shapedTextSizeWidthPx(line.widthPx)));
  return justifyParagraph(lines, fitWidthPx, flags, fontSizePx);
}

interface JustifyParagraphsOptions {
  /** The width each fitted line reaches, px. */
  widthPx: number;
  flags: number;
  fontSizePx: number;
  /** Whether the paragraph starting at this line index has FILL alignment. Undefined fits every paragraph. */
  isFilled?: (firstLineIndex: number) => boolean;
}

/**
 * The lines of Label (`label.cpp:272-319`) and RichTextLabel (`TextParagraph::_shape_lines`,
 * `text_paragraph.cpp:234-292`), which fit each paragraph on its own: `jst_to_line` counts inside
 * the paragraph, so each one skips its own last line. Lines of a paragraph are adjacent.
 */
export function justifyParagraphs(
  lines: readonly TextLineLayout[],
  options: JustifyParagraphsOptions
): TextLineLayout[] {
  const { widthPx, flags, fontSizePx, isFilled = () => true } = options;
  const justified: TextLineLayout[] = [];
  let first = 0;
  while (first < lines.length) {
    let end = first + 1;
    while (end < lines.length && !startsParagraph(lines, end)) end++;
    if (isFilled(first)) {
      justified.push(...justifyParagraph(lines.slice(first, end), widthPx, flags, fontSizePx));
    } else {
      for (let i = first; i < end; i++) justified.push(lines[i]!);
    }
    first = end;
  }
  return justified;
}
