/**
 * Line justification, a port of `TextServer::shaped_text_fit_to_width`
 * (`modules/text_server_adv/text_server_adv.cpp:5531-5686`) scoped to what a Latin font with no
 * kashida elongation glyphs and no BiDi reaches. It ports `WORD_BOUND`, `TRIM_EDGE_SPACES` and
 * `AFTER_LAST_TAB`. Each other `JustificationFlag` member says why it does nothing here.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { isTabChar, isWhitespace, type TextLineLayout } from './textLayout';

/** `TextServer::JustificationFlag` (`servers/text/text_server.h:78-87`). */
export enum JustificationFlag {
  NONE = 0,
  /**
   * Never consulted: it fires only on `GRAPHEME_IS_ELONGATION` glyphs (Arabic-script tatweel
   * runs), which this engine's Latin shaper never tags.
   */
  KASHIDA = 1 << 0,
  /** Grows or shrinks every space glyph. */
  WORD_BOUND = 1 << 1,
  /** Zeroes the edge spaces' own advance before measuring. */
  TRIM_EDGE_SPACES = 1 << 2,
  /** Justifies only the run after the last tab. */
  AFTER_LAST_TAB = 1 << 3,
  /**
   * Not wired. It narrows the justified range to an earlier overrun trim's cut point, which only a
   * Label with autowrap off, `HORIZONTAL_ALIGNMENT_FILL` and a trimming `text_overrun_behavior`
   * reaches (the label slice's `comparison.md`).
   */
  CONSTRAIN_ELLIPSIS = 1 << 4,
  /**
   * With the next two, decides which lines a caller fits at all (`label.cpp:273-297`), never
   * anything inside one line's fit, so it is the caller's business.
   */
  SKIP_LAST_LINE = 1 << 5,
  SKIP_LAST_LINE_WITH_VISIBLE_CHARS = 1 << 6,
  DO_NOT_SKIP_SINGLE_LINE = 1 << 7,
}

export interface FitLineOptions {
  fontSizePx: number;
}

export interface FitLineResult {
  line: TextLineLayout;
  /** `sd->fit_width_minimum_reached` (`:5677-5679`): a shrinking line could not reach `widthPx`. */
  fitWidthMinimumReached: boolean;
}

/**
 * Port of `TextServer::shaped_text_fit_to_width`, scoped per this module's own doc. The source's
 * `adv_remain` whole-pixel carry (`:5662-5671`) is not ported: `gl.advance = new_advance` runs
 * before `adv_remain += (new_advance - gl.advance)`, so the carry is always zero.
 */
export function fitLineToWidth(line: TextLineLayout, widthPx: number, flags: JustificationFlag, options: FitLineOptions): FitLineResult {
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
  // The `else` branch (`:5601-5607`, skip breaks without resetting width) is
  // unreachable here: this engine's line breaker never leaves a hard/soft
  // break glyph at an emitted line's interior edge -- breaks are what split
  // lines apart in the first place.

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
