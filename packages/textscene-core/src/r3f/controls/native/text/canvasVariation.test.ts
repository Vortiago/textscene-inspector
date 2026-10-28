import { describe, expect, it, vi } from 'vitest';
import { variedGlyphContours } from './canvasVariation';
import type { GlyphContours } from './glyphContours';
import type { SfntOutlines } from './sfntOutlines';

const CONTOURS: GlyphContours = { points: [], contourEnds: [], isFillRight: true };

function countingOutlines() {
  const glyphContours = vi.fn((): GlyphContours | null => CONTOURS);
  const outlines: SfntOutlines = { glyphIndex: (codePoint) => codePoint - 64, glyphContours };
  return { outlines, glyphContours };
}

describe('variedGlyphContours', () => {
  // A paint at a new tint, such as a modulate animation, asks for every glyph again.
  it('reads the contours of a glyph once across paints', () => {
    const { outlines, glyphContours } = countingOutlines();

    variedGlyphContours(outlines, 'A', 16, { embolden: 1.2, skew: 0 });
    variedGlyphContours(outlines, 'A', 16, { embolden: 1.2, skew: 0 });

    expect(glyphContours).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['size', 24, { embolden: 1.2, skew: 0 }],
    ['embolden', 16, { embolden: 2, skew: 0 }],
    ['skew', 16, { embolden: 1.2, skew: 0.3 }],
  ])('reads a glyph again for another %s', (_what, fontSizePx, variation) => {
    const { outlines, glyphContours } = countingOutlines();

    variedGlyphContours(outlines, 'A', 16, { embolden: 1.2, skew: 0 });
    variedGlyphContours(outlines, 'A', fontSizePx, variation);

    expect(glyphContours).toHaveBeenCalledTimes(2);
  });

  it('answers null for a character the font lacks, and reads no contours', () => {
    const { outlines, glyphContours } = countingOutlines();

    expect(variedGlyphContours(outlines, '@', 16, { embolden: 1.2, skew: 0 })).toBeNull();
    expect(glyphContours).not.toHaveBeenCalled();
  });
});
