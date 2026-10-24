/**
 * Line justification, a port of `TextServer::shaped_text_fit_to_width`
 * (`modules/text_server_adv/text_server_adv.cpp:5531-5686`) scoped to what a Latin font with no
 * kashida elongation glyphs and no BiDi reaches. It ports `WORD_BOUND`, `TRIM_EDGE_SPACES` and
 * `AFTER_LAST_TAB`. Without `TRIM_EDGE_SPACES` it skips the break spaces at the ends of a line, as
 * `shaped_text_fit_to_width` does. The other flags do nothing here:
 * - `KASHIDA` fires only on elongation glyphs (Arabic tatweel runs), which the Latin shaper never tags.
 * - `CONSTRAIN_ELLIPSIS` is not wired. It needs a Label with autowrap off, `HORIZONTAL_ALIGNMENT_FILL`
 *   and a trimming `text_overrun_behavior` (the label slice's `comparison.md`).
 * - The `SKIP_LAST_LINE` flags and `DO_NOT_SKIP_SINGLE_LINE` decide which lines a caller fits at all,
 *   so they are the caller's business, and `justifyToLineIndex` answers it for Label and TextMesh.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { isTabChar, isWhitespace, type GlyphPlacement, type TextLineLayout } from './textLayout';
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
}

interface FitLineResult {
  line: TextLineLayout;
  /** `sd->fit_width_minimum_reached` (`:5677-5679`): a shrinking line could not reach `widthPx`. */
  fitWidthMinimumReached: boolean;
}

/**
 * Port of `TextServer::shaped_text_fit_to_width`, scoped per this module's own doc. The source's
 * `adv_remain` whole-pixel carry (`:5662-5671`) is not ported: `gl.advance = new_advance` runs
 * before `adv_remain += (new_advance - gl.advance)`, so the carry is always zero.
 */
export function fitLineToWidth(
  line: TextLineLayout,
  widthPx: number,
  flags: EnumValue<typeof JustificationFlag>,
  options: FitLineOptions
): FitLineResult {
  const glyphs = line.glyphs;
  if (glyphs.length === 0) return { line, fitWidthMinimumReached: false };

  let startPos = 0;
  let endPos = glyphs.length - 1;

  // :5547-5570
  if (flags & JustificationFlag.AFTER_LAST_TAB) {
    for (let i = glyphs.length - 1; i >= 0; i--) {
      if (isTabChar(glyphs[i]!.char)) {
        startPos = i;
        break;
      }
    }
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
  const minSpaceAdvancePx = 0.1 * options.fontSizePx;

  let cumulativeShiftPx = 0;
  const outGlyphs = glyphs.map((g, i) => {
    const x = g.x + cumulativeShiftPx;
    let advance = g.advance;
    if (zeroedAdvanceAt.has(i)) {
      advance = 0;
    } else if (wordBound && i >= startPos && i <= endPos && g.char === ' ') {
      advance = Math.max(g.advance + deltaPerSpacePx, minSpaceAdvancePx);
    }
    cumulativeShiftPx += advance - g.advance;
    return { ...g, x, advance };
  });

  const finalWidthPx = line.widthPx + cumulativeShiftPx;
  // :5677-5679 -- checked against the FINAL (post-adjustment) width.
  const fitWidthMinimumReached = Math.floor(widthPx) < Math.floor(finalWidthPx);

  return {
    line: { text: line.text, glyphs: outGlyphs, widthPx: finalWidthPx },
    fitWidthMinimumReached,
  };
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
export function justifyToLineIndex(lines: readonly TextLineLayout[], flags: number): number {
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
