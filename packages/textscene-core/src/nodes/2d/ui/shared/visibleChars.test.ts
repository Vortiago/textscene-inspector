import { describe, expect, it } from 'vitest';
import { VisibleCharactersBehavior } from '../../../../godot/text/textServerEnums';
import type { GlyphPlacement, TextLineLayout } from '../../../../r3f/controls/native/text/textLayout';
import type { FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import {
  applyVisibleCharsReveal,
  resolveLabelVisibleChars,
  resolveRichTextVisibleChars,
} from './visibleChars';

const DEFAULT_FONT = {} as FontMetrics;

/** A line of default-font glyphs, one per character; the font draws the sequences `ff`, `fi`, `fl`, `ffi` and `ffl` as one glyph. */
function defaultFontLine(text: string): TextLineLayout {
  const glyphs: GlyphPlacement[] = [...text].map((char, i) => ({
    char,
    x: i,
    advance: 1,
    sourceIndex: i,
    glyph: {} as GlyphPlacement['glyph'],
    fontSizePx: 16,
    fontMetrics: DEFAULT_FONT,
  }));
  return { text, glyphs, widthPx: text.length, paragraphIndex: 0 };
}

const glyphBudget = (visibleRatio: number) => ({
  behavior: VisibleCharactersBehavior.VC_GLYPHS_LTR,
  text: '',
  visibleChars: undefined,
  visibleRatio,
});

describe('resolving visible_characters and visible_ratio', () => {
  it('multiplies the total and the ratio in single precision, as `get_total_character_count() * p_ratio` does', () => {
    // 44 * 0.6818181818181818 in double precision is 29.999999999999996, which truncates to 29. Godot's float gives 30.
    expect(resolveLabelVisibleChars({ visible_ratio: String(30 / 44) }, () => 44)?.visibleChars).toBe(30);
  });

  it('resets the ratio on empty text for Label and keeps it for RichTextLabel', () => {
    const properties = { visible_ratio: '0.5', visible_characters: '3' };
    expect(resolveLabelVisibleChars(properties, () => 0)?.visibleRatio).toBe(1);
    expect(resolveRichTextVisibleChars(properties, () => 0)?.visibleRatio).toBe(0.5);
  });
});

// Measured with `pnpm ref:godot`: "abcdefgh" plus a ligature at visible_ratio 0.99 shows no ligature,
// since the eight letters and the one ligature glyph make nine glyphs and 0.99 of them is eight.
describe('applyVisibleCharsReveal ligatures', () => {
  it.each(['ff', 'fi', 'fl', 'ffi', 'ffl'])('counts %s as one glyph', (ligature) => {
    const [line] = applyVisibleCharsReveal([defaultFontLine(`abcdefgh${ligature}`)], glyphBudget(0.99));
    expect(line!.text).toBe(`abcdefgh${ligature}`);
    expect(line!.glyphs.map((glyph) => glyph.char).join('')).toBe('abcdefgh');
  });

  it.each(['ft', 'tt', 'fj', 'fb', 'fh', 'fk', 'Th'])('counts %s as two glyphs', (pair) => {
    const [line] = applyVisibleCharsReveal([defaultFontLine(`abcdefgh${pair}`)], glyphBudget(0.99));
    expect(line!.glyphs.map((glyph) => glyph.char).join('')).toBe(`abcdefgh${pair[0]}`);
  });

  it('shows a ligature whole once the budget reaches it', () => {
    const [all] = applyVisibleCharsReveal([defaultFontLine('abffix')], glyphBudget(0.8));
    expect(all!.glyphs.map((glyph) => glyph.char).join('')).toBe('abffi');
  });

  it('forms no ligature across a change of font size, as the spans shape apart', () => {
    const line = defaultFontLine('abcdefghfi');
    line.glyphs[9]!.fontSizePx = 40;
    const [revealed] = applyVisibleCharsReveal([line], glyphBudget(0.99));
    expect(revealed!.glyphs.map((glyph) => glyph.char).join('')).toBe('abcdefghf');
  });

  it('draws no ligature for a glyph outside the default font atlas', () => {
    const line = defaultFontLine('abcdefghfi');
    for (const glyph of line.glyphs) glyph.glyph = null;
    const [revealed] = applyVisibleCharsReveal([line], glyphBudget(0.99));
    expect(revealed!.glyphs.map((glyph) => glyph.char).join('')).toBe('abcdefghf');
  });

  it('shows a ligature whole or not at all after shaping, by its last character', () => {
    const afterShaping = (visibleChars: number) => ({
      behavior: VisibleCharactersBehavior.VC_CHARS_AFTER_SHAPING,
      text: 'abffi',
      visibleChars,
      visibleRatio: undefined,
    });
    const shown = (visibleChars: number) =>
      applyVisibleCharsReveal([defaultFontLine('abffi')], afterShaping(visibleChars))[0]!
        .glyphs.map((glyph) => glyph.char)
        .join('');
    expect([shown(2), shown(4), shown(5)]).toEqual(['ab', 'ab', 'abffi']);
  });
});
