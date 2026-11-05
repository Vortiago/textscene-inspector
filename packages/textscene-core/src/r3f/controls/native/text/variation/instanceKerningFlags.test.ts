/**
 * The parts of a `kern` lookup that the fixture fonts leave out, on a font built in bytes: the lookup
 * flag that skips a glyph by its `GDEF` class (`check_glyph_property`, `hb-ot-layout-gsubgpos.hh:823-838`),
 * the mark filtering set and the mark attachment type (`match_properties_mark`, `:800-818`), and a
 * hinting device table, which HarfBuzz applies at no ppem that `hb-ft` sets (`hb-ft.cc:1365-1368`).
 */

import { describe, expect, it } from 'vitest';
import { instanceKerningReader } from './instanceKerning';
import {
  BOLD_NORMALIZED,
  syntheticKernFont,
  type GlyphDefinitions,
  type KernLookup,
} from './syntheticGpos.testkit';

const IGNORE_BASE_GLYPHS = 0x2;
const IGNORE_LIGATURES = 0x4;
const IGNORE_MARKS = 0x8;
const USE_MARK_FILTERING_SET = 0x10;
/** `MarkAttachmentType` 1, in the high byte of the flag. */
const MARK_ATTACHMENT_TYPE_1 = 0x0100;

const BASE = 1;
const LIGATURE = 2;
const MARK = 3;

const LETTER_A = 0x41;
const LETTER_V = 0x56;
const COMBINING_ACUTE = 0x0301;

/** The kerning at wght 700 of glyph 1 (`A`) before glyph 2, whose character is `rightCodePoint`. */
function kerning(
  lookup: Omit<KernLookup, 'left' | 'right' | 'xAdvance'>,
  definitions?: GlyphDefinitions,
  rightCodePoint = LETTER_V
): number {
  const font = syntheticKernFont([{ ...lookup, left: 1, right: 2, xAdvance: -50 }], definitions);
  const reader = instanceKerningReader(font)!(BOLD_NORMALIZED);
  return reader({ glyph: 1, codePoint: LETTER_A }, { glyph: 2, codePoint: rightCodePoint });
}

const classes = (left: number, right: number): GlyphDefinitions => ({
  glyphClasses: new Map([
    [1, left],
    [2, right],
  ]),
});

describe('a kern lookup flag', () => {
  it('kerns a pair of base glyphs under no flag', () => {
    expect(kerning({ flag: 0 }, classes(BASE, BASE))).toBe(-50);
  });

  it('skips a pair with a mark under IgnoreMarks', () => {
    expect(kerning({ flag: IGNORE_MARKS }, classes(BASE, MARK))).toBe(0);
  });

  it('skips a pair of base glyphs under IgnoreBaseGlyphs', () => {
    expect(kerning({ flag: IGNORE_BASE_GLYPHS }, classes(BASE, BASE))).toBe(0);
  });

  it('skips a pair with a ligature under IgnoreLigatures', () => {
    expect(kerning({ flag: IGNORE_LIGATURES }, classes(LIGATURE, BASE))).toBe(0);
  });

  it('kerns a pair with a mark under a flag that ignores ligatures alone', () => {
    expect(kerning({ flag: IGNORE_LIGATURES }, classes(BASE, MARK))).toBe(-50);
  });
});

describe('a kern lookup that filters marks', () => {
  it('kerns a mark of its mark attachment type', () => {
    const definitions = { ...classes(BASE, MARK), markAttachClasses: new Map([[2, 1]]) };
    expect(kerning({ flag: MARK_ATTACHMENT_TYPE_1 }, definitions)).toBe(-50);
  });

  it('skips a mark of another mark attachment type', () => {
    const definitions = { ...classes(BASE, MARK), markAttachClasses: new Map([[2, 2]]) };
    expect(kerning({ flag: MARK_ATTACHMENT_TYPE_1 }, definitions)).toBe(0);
  });

  it('kerns a mark its mark filtering set covers', () => {
    const definitions = { ...classes(BASE, MARK), markGlyphSets: [[7], [2]] };
    expect(kerning({ flag: USE_MARK_FILTERING_SET, markFilteringSet: 1 }, definitions)).toBe(-50);
  });

  it('skips a mark its mark filtering set leaves out', () => {
    const definitions = { ...classes(BASE, MARK), markGlyphSets: [[7], [2]] };
    expect(kerning({ flag: USE_MARK_FILTERING_SET, markFilteringSet: 0 }, definitions)).toBe(0);
  });
});

// `hb_synthesize_glyph_classes` (`hb-ot-shape.cc:867-890`) for a font with no `GDEF` glyph classes.
describe('a kern lookup over a font with no GDEF glyph classes', () => {
  it('skips a nonspacing mark character under IgnoreMarks', () => {
    expect(kerning({ flag: IGNORE_MARKS }, undefined, COMBINING_ACUTE)).toBe(0);
  });

  it('kerns a letter under IgnoreMarks', () => {
    expect(kerning({ flag: IGNORE_MARKS }, undefined, LETTER_V)).toBe(-50);
  });
});

describe('a hinting device table on the kerning', () => {
  it('adds nothing, as HarfBuzz applies it at a ppem of 0', () => {
    expect(kerning({ flag: 0, device: { start: 8, end: 72, pixels: 1 } }, classes(BASE, BASE))).toBe(-50);
  });
});
