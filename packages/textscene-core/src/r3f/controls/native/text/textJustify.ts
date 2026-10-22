/**
 * Line justification, a port of `TextServer::shaped_text_fit_to_width`
 * (`modules/text_server_adv/text_server_adv.cpp:5531-5686`) scoped to what a Latin font with no
 * kashida elongation glyphs and no BiDi reaches. It ports `WORD_BOUND`, `TRIM_EDGE_SPACES` and
 * `AFTER_LAST_TAB`. The other flags do nothing here:
 * - `KASHIDA` fires only on elongation glyphs (Arabic tatweel runs), which the Latin shaper never tags.
 * - `CONSTRAIN_ELLIPSIS` is not wired. It needs a Label with autowrap off, `HORIZONTAL_ALIGNMENT_FILL`
 *   and a trimming `text_overrun_behavior` (the label slice's `comparison.md`).
 * - The `SKIP_LAST_LINE` flags and `DO_NOT_SKIP_SINGLE_LINE` decide which lines a caller fits at all
 *   (`label.cpp:273-297`), so they are the caller's business.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import { isTabChar, isWhitespace, type TextLineLayout } from './textLayout';
import { JustificationFlag } from '../../../../godot/text/textServerEnums';
import type { EnumValue } from '../../../../godot/classdb/enumNames.js';

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
