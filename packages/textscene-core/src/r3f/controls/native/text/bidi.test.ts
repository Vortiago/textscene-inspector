/**
 * `resolveParagraphBidi` runs the Unicode bidirectional algorithm as Godot's advanced text server
 * does: the paragraph direction (`text_server_adv.cpp:7231-7256`), one run per override range
 * (`:7258-7300`) and the reorder of each line on its own (`_shape_substr`, `:5350-5420`).
 */
import { describe, expect, it } from 'vitest';
import { resolveParagraphBidi } from './bidi';
import { TextDirection } from '../../../../godot/text/textServerEnums';

const { TEXT_DIRECTION_AUTO, TEXT_DIRECTION_LTR, TEXT_DIRECTION_RTL, TEXT_DIRECTION_INHERITED } =
  TextDirection;

/** The characters of `text` that the glyphs of `[start, end)` draw, left to right. */
function visualText(text: string, direction: number, start = 0, end = text.length, language = ''): string {
  const bidi = resolveParagraphBidi(text, { direction, language });
  return bidi
    .visualOrder(start, end)
    .map((index) => bidi.glyphChar(index))
    .join('');
}

describe('resolveParagraphBidi', () => {
  it('keeps the Latin words of an AUTO paragraph in place and reverses its Hebrew run', () => {
    expect(visualText('abc שלום def', TEXT_DIRECTION_AUTO)).toBe('abc םולש def');
    expect(resolveParagraphBidi('abc שלום def').isRtl).toBe(false);
  });

  it('resolves an LTR Latin paragraph to level 0 throughout, in logical order', () => {
    const bidi = resolveParagraphBidi('Hello (world) 123');
    expect(bidi.isLeftToRight).toBe(true);
    expect(bidi.visualOrder(6, 13)).toEqual([6, 7, 8, 9, 10, 11, 12]);
    expect(bidi.glyphChar(6)).toBe('(');
  });

  it('runs the bidi pass on an RTL Latin paragraph, whose levels are not all 0', () => {
    expect(resolveParagraphBidi('Hello!', { direction: TEXT_DIRECTION_RTL }).isLeftToRight).toBe(false);
  });

  it('puts the `!` of an RTL Latin paragraph first', () => {
    expect(visualText('Hello!', TEXT_DIRECTION_RTL)).toBe('!Hello');
    expect(resolveParagraphBidi('Hello!', { direction: TEXT_DIRECTION_RTL }).isRtl).toBe(true);
  });

  it('keeps the `!` of an LTR Hebrew paragraph last and reverses the Hebrew run, space and all', () => {
    expect(visualText('שלום עולם!', TEXT_DIRECTION_LTR)).toBe('םלוע םולש!');
  });

  it('infers RTL from the first strong character, mirrors both parentheses and keeps the number LTR', () => {
    const bidi = resolveParagraphBidi('(שלום) 123', { direction: TEXT_DIRECTION_AUTO });
    expect(bidi.isRtl).toBe(true);
    expect(visualText('(שלום) 123', TEXT_DIRECTION_AUTO)).toBe('123 (םולש)');
  });

  it('takes a text with no strong character from the language', () => {
    expect(resolveParagraphBidi('123!', { language: 'he' }).isRtl).toBe(true);
    expect(visualText('123!', TEXT_DIRECTION_AUTO, 0, 4, 'he')).toBe('!123');
    expect(resolveParagraphBidi('123!', { language: 'he_IL' }).isRtl).toBe(true);
    expect(resolveParagraphBidi('123!').isRtl).toBe(false);
    expect(visualText('123!', TEXT_DIRECTION_AUTO)).toBe('123!');
  });

  it('treats INHERITED as AUTO, as the text server does (`text_server_adv.cpp:7240`)', () => {
    expect(resolveParagraphBidi('שלום', { direction: TEXT_DIRECTION_INHERITED }).isRtl).toBe(true);
    expect(resolveParagraphBidi('abc', { direction: TEXT_DIRECTION_INHERITED }).isRtl).toBe(false);
  });

  it('reorders each line of a two-line RTL paragraph on its own', () => {
    const text = 'שלום עולם abc def';
    // The break leaves the space at 9 out of both lines, as the line breaker trims edge spaces.
    expect(visualText(text, TEXT_DIRECTION_RTL, 0, 9)).toBe('םלוע םולש');
    expect(visualText(text, TEXT_DIRECTION_RTL, 10, 17)).toBe('abc def');
    expect(visualText(text, TEXT_DIRECTION_RTL, 0, 13)).toBe('abc םלוע םולש');
  });

  it('runs each override range on its own and keeps the ranges in logical order left to right', () => {
    const text = 'שלום/abc';
    const bidi = resolveParagraphBidi(text, {
      direction: TEXT_DIRECTION_RTL,
      overrides: [
        { start: 0, end: 4, direction: TEXT_DIRECTION_AUTO },
        { start: 4, end: 5, direction: TEXT_DIRECTION_LTR },
        { start: 5, end: 8, direction: TEXT_DIRECTION_AUTO },
      ],
    });
    expect(bidi.isRtl).toBe(true);
    expect(
      bidi
        .visualOrder(0, text.length)
        .map((index) => bidi.glyphChar(index))
        .join('')
    ).toBe('םולש/abc');
  });

  it('runs an INHERITED range at the paragraph direction', () => {
    const text = 'ab!';
    const bidi = resolveParagraphBidi(text, {
      direction: TEXT_DIRECTION_RTL,
      overrides: [{ start: 0, end: 3, direction: TEXT_DIRECTION_INHERITED }],
    });
    expect(bidi.visualOrder(0, 3)).toEqual([2, 0, 1]);
  });

  it('gives no glyph to a character that no override range covers, as only the ranges are shaped', () => {
    const text = 'ab!cd';
    const bidi = resolveParagraphBidi(text, {
      direction: TEXT_DIRECTION_RTL,
      overrides: [{ start: 3, end: 5, direction: TEXT_DIRECTION_LTR }],
    });
    expect(bidi.visualOrder(0, 5)).toEqual([3, 4]);
    expect(Array.from(bidi.rangeIds)).toEqual([-1, -1, -1, 0, 0]);
  });

  it('shapes every character when no override range is given', () => {
    const bidi = resolveParagraphBidi('ab', { overrides: [] });
    expect(Array.from(bidi.rangeIds)).toEqual([0, 0]);
  });

  it('mirrors only a character at an odd level', () => {
    const bidi = resolveParagraphBidi('(a) (ש)', { direction: TEXT_DIRECTION_LTR });
    expect([0, 2, 4, 6].map((index) => bidi.glyphChar(index))).toEqual(['(', ')', '(', ')']);
    const rtl = resolveParagraphBidi('(ש)', { direction: TEXT_DIRECTION_RTL });
    expect([0, 2].map((index) => rtl.glyphChar(index))).toEqual([')', '(']);
  });
});
