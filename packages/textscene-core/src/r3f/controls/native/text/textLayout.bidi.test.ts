/**
 * `shapeText` places each line's glyphs in the visual order of the Unicode bidirectional algorithm,
 * as Godot's advanced text server does (`text_server_adv.cpp:5350-5420,7231-7300`). The line breaks
 * stay in logical order, so a Latin paragraph shapes as before.
 */
import { describe, expect, it } from 'vitest';
import { shapeText, type ShapeTextOptions, type TextLineLayout } from './textLayout';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import type { FontMetrics } from './fontMetrics';
import { AutowrapMode, StructuredTextParser, TextDirection } from '../../../../godot/text/textServerEnums';
import { parseStructuredText } from '../../../../godot/text/structuredText';

const ADLAM_ALIF = '\u{1E900}';
const ADLAM_DAALI = '\u{1E901}';
const MATHEMATICAL_BOLD_A = '\u{1D400}';

const BASE: ShapeTextOptions = {
  fontSizePx: 16,
  boxWidthPx: 0,
  autowrapMode: AutowrapMode.AUTOWRAP_OFF,
  lineSpacingPx: 0,
};

/** The line's glyph characters, left to right. */
function visualChars(line: TextLineLayout): string {
  return line.glyphs.map((glyph) => glyph.char).join('');
}

function firstLine(text: string, options: Partial<ShapeTextOptions> = {}): TextLineLayout {
  return shapeText(text, { ...BASE, ...options }).lines[0]!;
}

/** Each glyph's pen x starts where the glyph on its left ends. */
function expectContiguousPen(line: TextLineLayout): void {
  let penX = 0;
  for (const glyph of line.glyphs) {
    expect(glyph.x).toBeCloseTo(penX, 9);
    penX += glyph.advance;
  }
  expect(line.widthPx).toBeCloseTo(penX, 9);
}

describe('shapeText — bidirectional text', () => {
  it('reverses the Hebrew run of an AUTO Latin paragraph and keeps the Latin words in place', () => {
    const line = firstLine('abc שלום def');
    expect(visualChars(line)).toBe('abc םולש def');
    expectContiguousPen(line);
  });

  it('keeps the index of each glyph’s source character', () => {
    const line = firstLine('abc שלום def');
    expect(line.glyphs.map((glyph) => glyph.sourceIndex)).toEqual([0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11]);
  });

  it('keeps the line text in logical order', () => {
    expect(firstLine('abc שלום def').text).toBe('abc שלום def');
  });

  it('defaults to AUTO, which puts the `!` of a Hebrew paragraph at its visual left', () => {
    expect(visualChars(firstLine('שלום!'))).toBe('!םולש');
  });

  it('shapes a Latin paragraph at RTL with its `!` first', () => {
    expect(visualChars(firstLine('Hello!', { direction: TextDirection.TEXT_DIRECTION_RTL }))).toBe('!Hello');
  });

  it('mirrors a paired character at an odd level, so its advance and ink are the mirror’s', () => {
    const line = firstLine('(שלום) 123');
    expect(visualChars(line)).toBe('123 (םולש)');
    expectContiguousPen(line);
  });

  it('takes the direction of a text with no strong character from the language', () => {
    expect(visualChars(firstLine('123!', { language: 'he' }))).toBe('!123');
    expect(visualChars(firstLine('123!'))).toBe('123!');
  });

  it('reorders each line of a wrapped RTL paragraph on its own', () => {
    // Wide enough for the first three words and the space after them, so `d` breaks the line.
    const boxWidthPx = firstLine('שלום עולם abc ').widthPx + 1;
    const { lines } = shapeText('שלום עולם abc def', {
      ...BASE,
      boxWidthPx,
      autowrapMode: AutowrapMode.AUTOWRAP_WORD_SMART,
      direction: TextDirection.TEXT_DIRECTION_RTL,
    });
    expect(lines.map(visualChars)).toEqual(['abc םלוע םולש', 'def']);
  });

  it('keeps the structured override ranges in logical order left to right under RTL', () => {
    const text = 'שלום/עולם/abc.txt';
    const withRanges = firstLine(text, {
      direction: TextDirection.TEXT_DIRECTION_RTL,
      bidiOverride: (paragraph) =>
        parseStructuredText(StructuredTextParser.STRUCTURED_TEXT_FILE, [], paragraph),
    });
    expect(visualChars(withRanges)).toBe('םולש/םלוע/abc.txt');
    const withoutRanges = firstLine(text, { direction: TextDirection.TEXT_DIRECTION_RTL });
    expect(visualChars(withoutRanges).startsWith('abc.txt')).toBe(true);
  });

  it('drops the characters outside every override range from the line and its width', () => {
    // Godot's LIST parser skips the first part, so `abc` has no range and no glyph.
    const line = firstLine('abc,de', {
      bidiOverride: (paragraph) =>
        parseStructuredText(StructuredTextParser.STRUCTURED_TEXT_LIST, [','], paragraph),
    });
    expect(visualChars(line)).toBe(',de');
    expectContiguousPen(line);
  });

  it('shapes each override range as its own run, so no kerning pair crosses a range edge', () => {
    const kerned: FontMetrics = {
      ...OPEN_SANS_FONT_METRICS,
      getKerningAdjustmentUnits: (a, b) => (a === 'a' && b === '/' ? -400 : 0),
    };
    const fileRanges = (paragraph: string) =>
      parseStructuredText(StructuredTextParser.STRUCTURED_TEXT_FILE, [], paragraph);
    const plain = firstLine('a/b', { fontMetrics: { ...kerned, getKerningAdjustmentUnits: () => 0 } });
    expect(firstLine('a/b', { fontMetrics: kerned }).widthPx).toBeLessThan(plain.widthPx);
    expect(firstLine('a/b', { fontMetrics: kerned, bidiOverride: fileRanges }).widthPx).toBe(plain.widthPx);
  });

  it('runs the override ranges over each paragraph text, its terminator included', () => {
    const seen: string[] = [];
    shapeText('a\nb', {
      ...BASE,
      paragraphSeparator: '\n',
      bidiOverride: (paragraph) => {
        seen.push(paragraph);
        return [];
      },
    });
    expect(seen).toEqual(['a​', 'b​']);
  });

  it('adds a kerning pair of an RTL run between its two visual neighbours', () => {
    const KERN_UNITS = -400;
    const kerned: FontMetrics = {
      ...OPEN_SANS_FONT_METRICS,
      getKerningAdjustmentUnits: (a, b) => (a === 'ש' && b === 'ל' ? KERN_UNITS : 0),
    };
    const plain = firstLine('של', { fontMetrics: { ...kerned, getKerningAdjustmentUnits: () => 0 } });
    const line = firstLine('של', { fontMetrics: kerned });
    // Visual order is ל then ש: the pair narrows the gap after ל, and the line by the same amount.
    expect(visualChars(line)).toBe('לש');
    const narrowedPx = plain.glyphs[1]!.x - line.glyphs[1]!.x;
    expect(narrowedPx).toBeGreaterThan(0);
    expect(plain.widthPx - line.widthPx).toBeCloseTo(narrowedPx, 9);
  });
});

describe('shapeText — language', () => {
  it('upper-cases with the language’s rules: `tr` gives a dotted capital I', () => {
    expect(firstLine('istanbul', { uppercase: true, language: 'tr' }).text).toBe('İSTANBUL');
    expect(firstLine('istanbul', { uppercase: true, language: 'tr_TR' }).text).toBe('İSTANBUL');
  });

  it('upper-cases with the root rules without a language', () => {
    expect(firstLine('istanbul', { uppercase: true }).text).toBe('ISTANBUL');
  });

  it('draws an astral right-to-left word in visual order, one glyph per letter', () => {
    const line = firstLine(`${ADLAM_ALIF}${ADLAM_DAALI} abc`);
    expect(visualChars(line)).toBe(`abc ${ADLAM_DAALI}${ADLAM_ALIF}`);
    expect(line.glyphs.map((glyph) => glyph.sourceIndex)).toEqual([5, 6, 7, 4, 2, 0]);
    expectContiguousPen(line);
  });

  it('draws an astral left-to-right letter as one glyph', () => {
    const line = firstLine(`${MATHEMATICAL_BOLD_A}b`);
    expect(line.glyphs.map((glyph) => [glyph.char, glyph.sourceIndex])).toEqual([
      [MATHEMATICAL_BOLD_A, 0],
      ['b', 2],
    ]);
  });
});
