/**
 * The per-glyph search of a face's fallback chain (`FontMetrics.fallbacks`): Godot shapes a run in the
 * first font, then shapes each run of invalid glyphs again in the next (`text_server_adv.cpp:7111-7130`).
 * Every advance is a whole multiple of 1/64 px at 16 px over a 2048-unit em, so no quantisation step
 * hides a wrong face.
 */
import { describe, expect, it } from 'vitest';
import { shapeText, type GlyphPlacement } from './textLayout';
import type { FontMetrics } from './fontMetrics';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';

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

function glyphsOf(text: string, fontMetrics: FontMetrics, fontSizePx = 16): GlyphPlacement[] {
  return shapeText(text, {
    fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 0,
    fontMetrics,
  }).lines[0]!.glyphs.filter((glyph) => glyph.char !== '\u200b');
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
  it("carries the face's rounding remainder across a glyph a fallback draws", () => {
    const halfPixelOver = faceOf({ A: 1056 });
    const [first, , last] = glyphsOf('A一A', { ...halfPixelOver, fallbacks: [CJK] }, 32);
    expect([first!.advance, last!.advance]).toEqual([17, 16]);
  });

  it("starts the fallback's own rounding remainder at zero", () => {
    const [, han] = glyphsOf('A一', { ...faceOf({ A: 1056 }), fallbacks: [faceOf({ 一: 1056 })] }, 32);
    expect(han!.advance).toBe(17);
  });
});
