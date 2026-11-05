import { describe, expect, it, vi } from 'vitest';
import { glyphContoursReader } from './canvasVariation';
import type { GlyphContours } from './glyphContours';
import type { SfntOutlines } from './sfntOutlines';

const CONTOURS: GlyphContours = { points: [], contourEnds: [], isFillRight: true };

function countingOutlines() {
  const glyphContours = vi.fn((): GlyphContours | null => CONTOURS);
  const outlines: SfntOutlines = { glyphIndex: (codePoint) => codePoint - 64, glyphContours };
  return { outlines, glyphContours };
}

describe('glyphContoursReader', () => {
  // A paint at a new tint, such as a modulate animation, asks for every glyph again.
  it('reads the contours of a glyph once across paints', () => {
    const { outlines, glyphContours } = countingOutlines();

    glyphContoursReader(outlines, 16, { embolden: 1.2, skew: 0 })('A');
    glyphContoursReader(outlines, 16, { embolden: 1.2, skew: 0 })('A');

    expect(glyphContours).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['size', 24, { embolden: 1.2, skew: 0 }],
    ['embolden', 16, { embolden: 2, skew: 0 }],
    ['skew', 16, { embolden: 1.2, skew: 0.3 }],
  ])('reads a glyph again for another %s', (_what, fontSizePx, variation) => {
    const { outlines, glyphContours } = countingOutlines();

    glyphContoursReader(outlines, 16, { embolden: 1.2, skew: 0 })('A');
    glyphContoursReader(outlines, fontSizePx, variation)('A');

    expect(glyphContours).toHaveBeenCalledTimes(2);
  });

  it('answers null for a character the font lacks, and reads no contours', () => {
    const { outlines, glyphContours } = countingOutlines();

    expect(glyphContoursReader(outlines, 16, { embolden: 1.2, skew: 0 })('@')).toBeNull();
    expect(glyphContours).not.toHaveBeenCalled();
  });

  it('keeps the contours of the latest sizes, so a size animation holds a bounded cache', () => {
    const { outlines, glyphContours } = countingOutlines();
    const variation = { embolden: 1.2, skew: 0 };

    for (let size = 10; size < 30; size++) glyphContoursReader(outlines, size, variation)('A');
    glyphContours.mockClear();
    glyphContoursReader(outlines, 29, variation)('A');
    glyphContoursReader(outlines, 10, variation)('A');

    expect(glyphContours).toHaveBeenCalledTimes(1);
  });
});
