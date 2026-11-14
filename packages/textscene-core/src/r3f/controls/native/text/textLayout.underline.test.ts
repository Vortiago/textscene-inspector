/**
 * The underline of a shaped line: the largest position and thickness of every face its shaping tries,
 * as `_shape_run` widens `upos` and `uthk` (`text_server_adv.cpp:7174-7175`, `:7189-7190`), copied
 * from the paragraph to each line (`:5310-5311`).
 */
import { describe, expect, it } from 'vitest';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import type { FontMetrics } from './fontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { shapeText, type ShapeTextOptions } from './textLayout';

/** A 1000-unit face with a glyph for the characters of `chars` and the given FreeType underline. */
function faceOf(chars: string, underlinePosition: number, underlineThickness: number): FontMetrics {
  return {
    kind: 'canvas',
    unitsPerEm: 1000,
    ascent: 800,
    descent: 200,
    hasGlyph: (ch) => chars.includes(ch),
    getGlyphAdvanceUnits: () => 500,
    getKerningAdjustmentUnits: () => 0,
    averageAdvanceUnits: 500,
    underlinePosition,
    underlineThickness,
  };
}

const THIN_LOW = faceOf('Ab ', -250, 50);
const THICK_HIGH = faceOf('Abא', -100, 150);
const UNUSED = faceOf('Abא一', -400, 300);

function underlineOf(
  text: string,
  options: Partial<ShapeTextOptions> & Pick<ShapeTextOptions, 'fontMetrics'>
) {
  const layout = shapeText(text, {
    fontSizePx: 20,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 0,
    ...options,
  });
  return layout.lines.map((line) => line.underline);
}

describe('shapeText — the underline of a line', () => {
  it("sizes the face's own underline at the font size", () => {
    expect(underlineOf('Ab', { fontMetrics: THIN_LOW })).toEqual([{ positionPx: 5, thicknessPx: 1 }]);
  });

  it('scales the underline with the font size', () => {
    expect(underlineOf('Ab', { fontMetrics: THIN_LOW, fontSizePx: 40 })).toEqual([
      { positionPx: 10, thicknessPx: 2 },
    ]);
  });

  // Godot 4.6.3 measured: `ThemeDB.fallback_font.get_underline_position(16)` is 0.984375.
  it('reads the bundled font its own post underline: Open Sans -100, 50 over 2048 units', () => {
    expect(underlineOf('Ab', { fontMetrics: OPEN_SANS_FONT_METRICS, fontSizePx: 16 })).toEqual([
      { positionPx: 0.984375, thicknessPx: 0.390625 },
    ]);
  });

  // FreeType rounds each to 26.6 (`FT_MulFix`): DejaVu Sans at 16 measures 0.671875 and 0.703125 in
  // Godot 4.6.3, where a plain scale gives 0.6640625 and 0.703125.
  it('rounds the underline to whole 1/64 px, as FreeType does', () => {
    const dejaVu = { ...faceOf('Ab', -85, 90), unitsPerEm: 2048 };
    expect(underlineOf('Ab', { fontMetrics: dejaVu, fontSizePx: 16 })).toEqual([
      { positionPx: 0.671875, thicknessPx: 0.703125 },
    ]);
  });

  it('takes no underline from a fallback that draws no glyph of the line', () => {
    expect(underlineOf('Ab', { fontMetrics: { ...THIN_LOW, fallbacks: [UNUSED] } })).toEqual([
      { positionPx: 5, thicknessPx: 1 },
    ]);
  });

  it('widens the underline by a fallback that draws a glyph, each part on its own', () => {
    expect(underlineOf('Aא', { fontMetrics: { ...THIN_LOW, fallbacks: [THICK_HIGH, UNUSED] } })).toEqual([
      { positionPx: 5, thicknessPx: 3 },
    ]);
  });

  it('widens the underline by each face tried before the fallback that draws the glyph', () => {
    const lacksHan = faceOf('A', -50, 400);
    expect(underlineOf('A一', { fontMetrics: { ...THIN_LOW, fallbacks: [lacksHan, UNUSED] } })).toEqual([
      { positionPx: 8, thicknessPx: 8 },
    ]);
  });

  it('widens the underline by every face of the chain for a character none of them has (edge case)', () => {
    expect(underlineOf('A😀', { fontMetrics: { ...THIN_LOW, fallbacks: [THICK_HIGH] } })).toEqual([
      { positionPx: 5, thicknessPx: 3 },
    ]);
  });

  it('keeps the underline of a span whose glyphs all draw in a fallback', () => {
    const latinOnly = faceOf('A', -500, 10);
    expect(underlineOf('א', { fontMetrics: { ...latinOnly, fallbacks: [THICK_HIGH] } })).toEqual([
      { positionPx: 10, thicknessPx: 3 },
    ]);
  });

  it('widens one paragraph by the faces of all its spans, on every line it wraps to', () => {
    const text = 'Ab Ab';
    const lines = underlineOf(text, {
      fontMetrics: THIN_LOW,
      boxWidthPx: 25,
      autowrapMode: AutowrapMode.AUTOWRAP_WORD,
      fontMetricsAt: (i) => (i < 3 ? THIN_LOW : THICK_HIGH),
      spanAt: (i) => (i < 3 ? 0 : 1),
    });
    expect(lines).toEqual([
      { positionPx: 5, thicknessPx: 3 },
      { positionPx: 5, thicknessPx: 3 },
    ]);
  });

  it('keeps each paragraph to its own faces', () => {
    const lines = underlineOf('Ab\nAb', {
      fontMetrics: THIN_LOW,
      paragraphSeparator: '\n',
      fontMetricsAt: (i) => (i < 3 ? THIN_LOW : THICK_HIGH),
      spanAt: (i) => (i < 3 ? 0 : 1),
    });
    expect(lines).toEqual([
      { positionPx: 5, thicknessPx: 1 },
      { positionPx: 2, thicknessPx: 3 },
    ]);
  });

  it('gives a face with no underline none (error path)', () => {
    const { underlinePosition: _p, underlineThickness: _t, ...noUnderline } = THIN_LOW;
    expect(underlineOf('Ab', { fontMetrics: noUnderline })).toEqual([{ positionPx: 0, thicknessPx: 0 }]);
  });
});
