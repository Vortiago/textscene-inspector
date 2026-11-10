/**
 * A pair kerning reader that keeps each answer: a layout kerns the same pairs again on every edit
 * of its text.
 */
import { orOnRangeError } from './sfntCmap';
import type { PairKerningReader } from './variation/instanceKerning';

/** Past the last glyph index, so `left * GLYPH_LIMIT + right` names one pair of glyphs. */
const GLYPH_LIMIT = 0x10000;
/** Past the last code point, so `left * CODE_POINT_LIMIT + right` names one pair, well inside 2^53. */
const CODE_POINT_LIMIT = 0x110000;

/**
 * `kerningOf`, with the answer for each pair kept by its glyphs, then by their characters: a font
 * with no `GDEF` class for a glyph gives it the lookup flags of its character.
 */
export function keptPairs(kerningOf: PairKerningReader): PairKerningReader {
  const kept = new Map<number, Map<number, number>>();
  return (left, right) => {
    const glyphPair = left.glyph * GLYPH_LIMIT + right.glyph;
    let byCharacters = kept.get(glyphPair);
    if (!byCharacters) kept.set(glyphPair, (byCharacters = new Map()));
    const characterPair = left.codePoint * CODE_POINT_LIMIT + right.codePoint;
    let units = byCharacters.get(characterPair);
    if (units === undefined)
      byCharacters.set(characterPair, (units = orOnRangeError(() => kerningOf(left, right), 0)));
    return units;
  };
}
