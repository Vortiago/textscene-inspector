/**
 * The per-glyph search of a face's fallback chain (`FontMetrics.fallbacks`): Godot shapes a run in the
 * first font, then shapes each run of invalid glyphs again in the next (`text_server_adv.cpp:7111-7130`).
 * Every advance is a whole multiple of 1/64 px at 16 px over a 2048-unit em, so no quantisation step
 * hides a wrong face.
 */
import { describe, expect, it } from 'vitest';
import { shapeText } from './textLayout';
import { lineTopsPx } from './lineExtent';
import type { FontMetrics } from './fontMetrics';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { glyphsOf } from './textLayout.testkit';

/** A 2048-unit face that has a glyph only for the characters of `advances`. */
function faceOf(advances: Record<string, number>, kerning: Record<string, number> = {}): FontMetrics {
  return {
    kind: 'canvas',
    unitsPerEm: 2048,
    ascent: 1536,
    descent: 512,
    hasGlyph: (ch) => ch in advances,
    getGlyphAdvanceUnits: (ch) => advances[ch] ?? 1024,
    getKerningAdjustmentUnits: (a, b) => kerning[a + b] ?? 0,
    averageAdvanceUnits: 1024,
  };
}

const LATIN = faceOf({ A: 1024, ' ': 512 });
const HEBREW = faceOf({ A: 256, א: 1536 });
const CJK = faceOf({ א: 256, 一: 2048 });

describe('shapeText — a fallback chain', () => {
  it('draws a character the face lacks from the first fallback that has it', () => {
    const [, han] = glyphsOf('A一', { ...LATIN, fallbacks: [HEBREW, CJK] });
    expect(han!.fontMetrics).toBe(CJK);
    expect(han!.advance).toBe(16);
  });

  it('takes the earlier fallback where two have the character', () => {
    const [alef] = glyphsOf('א', { ...LATIN, fallbacks: [HEBREW, CJK] });
    expect(alef!.advance).toBe(12);
  });

  it('keeps a character the face has in the face, though a fallback has it too', () => {
    const latin = { ...LATIN, fallbacks: [HEBREW] };
    const [a] = glyphsOf('A', latin);
    expect(a!.fontMetrics).toBe(latin);
    expect(a!.advance).toBe(8);
  });

  it('keeps a character that no font of the chain has in the face', () => {
    const latin = { ...LATIN, fallbacks: [HEBREW] };
    const [, han] = glyphsOf('A一', latin);
    expect(han!.fontMetrics).toBe(latin);
  });

  it('keeps a space in the face, which HarfBuzz never marks invalid', () => {
    const latin = { ...faceOf({ A: 1024 }), fallbacks: [faceOf({ ' ': 2048 })] };
    const [, space] = glyphsOf('A A', latin);
    expect(space!.fontMetrics).toBe(latin);
  });

  it('kerns no pair across a fallback, as each face shapes its own run', () => {
    const kerning = { A一: -512 };
    const cjk = faceOf({ 一: 2048 }, kerning);
    const [a] = glyphsOf('A一', { ...faceOf({ A: 1024 }, kerning), fallbacks: [cjk] });
    expect(a!.advance).toBe(8);
  });

  // Above 20 px Godot rounds each advance and carries the remainder. A glyph the font lacks shapes
  // as index 0, which leaves the remainder untouched (`text_server_adv.cpp:7058`).
  it("carries the face's rounding remainder across a Latin glyph a fallback draws", () => {
    const halfPixelOver = faceOf({ A: 1056 });
    const [first, , last] = glyphsOf('ABA', { ...halfPixelOver, fallbacks: [faceOf({ B: 2048 })] }, 32);
    expect([first!.advance, last!.advance]).toEqual([17, 16]);
  });

  // A Han letter is a script run of its own (`ScriptIterator`), so the run after it starts at 0.
  it('restarts the rounding remainder after a Han glyph a fallback draws', () => {
    const halfPixelOver = faceOf({ A: 1056 });
    const [first, , last] = glyphsOf('A一A', { ...halfPixelOver, fallbacks: [CJK] }, 32);
    expect([first!.advance, last!.advance]).toEqual([17, 17]);
  });

  it('kerns a pair of astral characters that a fallback draws, as one run', () => {
    const emoji = faceOf({ '😀': 1024 }, { '😀😀': -512 });
    const [first] = glyphsOf('😀😀', { ...LATIN, fallbacks: [emoji] });
    expect(first!.advance).toBe(4);
  });

  it("carries the fallback's rounding remainder across a surrogate pair", () => {
    const [first, second] = glyphsOf('😀😀', { ...LATIN, fallbacks: [faceOf({ '😀': 1056 })] }, 32);
    expect([first!.advance, second!.advance]).toEqual([17, 16]);
  });

  // Godot marks a grapheme cluster valid only when every glyph of it is, and shapes a failed
  // cluster again whole in the next font (`text_server_adv.cpp:7119-7139`).
  it('draws a whole cluster from the first font that has every character of it', () => {
    const marks = faceOf({ e: 1024, '́': 0 });
    const glyphs = glyphsOf('é', { ...faceOf({ e: 1024 }), fallbacks: [marks] });
    expect(glyphs.map((glyph) => glyph.fontMetrics)).toEqual([marks, marks]);
  });

  it('keeps a cluster that no font of the chain has whole in the face', () => {
    const latin = { ...faceOf({ e: 1024 }), fallbacks: [faceOf({ '́': 0 })] };
    const glyphs = glyphsOf('é', latin);
    expect(glyphs.map((glyph) => glyph.fontMetrics)).toEqual([latin, latin]);
  });

  it("starts the fallback's own rounding remainder at zero", () => {
    const [, han] = glyphsOf('A一', { ...faceOf({ A: 1056 }), fallbacks: [faceOf({ 一: 1056 })] }, 32);
    expect(han!.advance).toBe(17);
  });
});

describe('shapeText — a character the face draws as a base and marks', () => {
  /**
   * A face that shapes `Ä` as A and a mark at `x`, `y` px from its origin. 2048 units, so 16 px is
   * 1/128 em: 1024 units are 8 px. Ascent 12 px, descent 4 px.
   */
  const withMark = (x: number, y: number, advanceUnits = 1024): FontMetrics => ({
    ...faceOf({ A: advanceUnits, Ä: advanceUnits, '\u0308': 0 }),
    shaping: (chars) => [
      {
        start: 0,
        end: chars.length,
        glyphs: [
          { glyph: 1, char: 'A', isMark: false },
          { glyph: 2, char: '\u0308', isMark: true },
        ],
      },
    ],
    markOffsets: (cluster) => cluster.map((_glyph, k) => (k === 0 ? { x: 0, y: 0 } : { x, y })),
  });
  const shapedLine = (face: FontMetrics) =>
    shapeText('Ä', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      lineSpacingPx: 0,
      fontMetrics: face,
    });

  it('draws the base with its advance', () => {
    const [base] = glyphsOf('Ä', withMark(4, 6));
    expect(base).toMatchObject({ char: 'A', x: 0, advance: 8 });
  });

  it('draws the mark at the pen after the base, with no advance and the base source index', () => {
    const [, mark] = glyphsOf('Ä', withMark(4, 6));
    expect(mark).toMatchObject({
      char: '\u0308',
      x: 8,
      advance: 0,
      xOffset: -4,
      yOffset: -6,
      sourceIndex: 0,
    });
  });

  it('rounds the y offset to a whole pixel', () => {
    expect(glyphsOf('Ä', withMark(0, 0.78125))[1]!.yOffset).toBe(-1);
  });

  it('rounds a half-way x offset from the pen after the base, away from zero', () => {
    // A 1397-unit advance is 21.83 px at 32 px, rounded to 22. A mark at 20.5 px is -1.5 px from that pen.
    expect(glyphsOf('Ä', withMark(20.5, 0, 1397), 32)[1]!.xOffset).toBe(-2);
  });

  /** The ascent and descent of the one line of `layout`. */
  const extentOf = ({ lines: [line] }: ReturnType<typeof shapedLine>) => [line!.ascentPx, line!.descentPx];

  it('lifts the ascent of the line to a mark raised past it (text_server_adv.cpp:5161)', () => {
    expect(extentOf(shapedLine(withMark(0, 15)))).toEqual([15, 4]);
  });

  it('lowers the descent of the line to a mark dropped past it', () => {
    expect(extentOf(shapedLine(withMark(0, -6)))).toEqual([12, 6]);
  });

  it('keeps the font line for a mark inside the ascent', () => {
    expect(extentOf(shapedLine(withMark(0, 6)))).toEqual([12, 4]);
  });
});

describe('shapeText — the ascent and descent of each line (text_server_adv.cpp:5161-5162)', () => {
  /** A face that draws only `←`, at ascent 16 px and descent 8 px at 16 px. */
  const TALL = { ...faceOf({ '←': 1024 }), ascent: 2048, descent: 1024 };
  const layoutOf = (text: string) =>
    shapeText(text, {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      lineSpacingPx: 2,
      fontMetrics: { ...LATIN, fallbacks: [TALL] },
      paragraphSeparator: '\n',
    });

  it('takes the ascent and descent of a taller fallback face on its own line only', () => {
    const { lines } = layoutOf('A\nA←\nA');
    expect(lines.map((line) => [line.ascentPx, line.descentPx])).toEqual([
      [12, 4],
      [16, 8],
      [12, 4],
    ]);
  });

  it('places each line below the ascent, descent and line spacing of the lines above it', () => {
    expect(lineTopsPx(layoutOf('A\nA←\nA'))).toEqual([0, 18, 44]);
  });

  it('sums the height of every line', () => {
    expect(layoutOf('A\nA←\nA').heightPx).toBe(62);
  });
  it('measures the font by its tallest fallback face though no glyph draws in it (font.cpp:210-220)', () => {
    expect(layoutOf('A').fontHeightPx).toBe(24);
  });
});
