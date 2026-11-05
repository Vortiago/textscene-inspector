import { describe, expect, it } from 'vitest';
import { blendGlyphBitmap, placedGlyphBitmap, type GlyphBitmap } from './glyphCoverage';
import type { GlyphContours } from './glyphContours';
import { ContourPointTag } from '../../../../godot/text/textServerEnums';

/** A square 2 px wide whose bottom-left corner is the glyph origin. */
const SQUARE: GlyphContours = {
  points: [
    { x: 0, y: 0, tag: ContourPointTag.ON },
    { x: 0, y: -2, tag: ContourPointTag.ON },
    { x: 2, y: -2, tag: ContourPointTag.ON },
    { x: 2, y: 0, tag: ContourPointTag.ON },
  ],
  contourEnds: [3],
  isFillRight: true,
};

const imageOf = (width: number, height: number): ImageData =>
  ({ data: new Uint8ClampedArray(width * height * 4), width, height, colorSpace: 'srgb' }) as ImageData;

describe('placedGlyphBitmap', () => {
  it('covers the pixels of the outline at a whole-pixel origin', () => {
    const bitmap = placedGlyphBitmap(SQUARE, 3, 5, 0)!;

    expect(bitmap.grid).toEqual({ left: 3, top: 3, width: 2, height: 2 });
    expect([...bitmap.coverage]).toEqual([255, 255, 255, 255]);
  });

  // Godot moves the outline by the subpixel step and draws the bitmap on whole pixels
  // (`text_server_adv.cpp:1303-1310`).
  it('moves the outline by the fraction of the origin and keeps the bitmap on whole pixels', () => {
    const bitmap = placedGlyphBitmap(SQUARE, 3.25, 5, 0)!;

    expect(bitmap.grid).toEqual({ left: 3, top: 3, width: 3, height: 2 });
    expect([...bitmap.coverage]).toEqual([192, 255, 64, 192, 255, 64]);
  });

  it('strokes the outline into a ring the radius each side of it', () => {
    const bitmap = placedGlyphBitmap(SQUARE, 3, 5, 1)!;

    expect(bitmap.grid).toEqual({ left: 2, top: 2, width: 4, height: 4 });
    expect(bitmap.coverage[0]).toBeGreaterThan(0);
  });

  it('draws nothing for an outline with no points', () => {
    expect(placedGlyphBitmap({ points: [], contourEnds: [], isFillRight: true }, 0, 0, 0)).toBeNull();
  });
});

describe('blendGlyphBitmap', () => {
  const half: GlyphBitmap = { grid: { left: 0, top: 0, width: 1, height: 1 }, coverage: Uint8Array.of(128) };

  it('lays the coverage in the colour as the alpha of the pixel', () => {
    const image = imageOf(1, 1);
    blendGlyphBitmap(image, half, [10, 20, 30]);

    expect([...image.data]).toEqual([10, 20, 30, 128]);
  });

  // Godot blends each glyph quad over the last, so two half-covered glyphs leave a quarter uncovered.
  it('combines the alphas of two glyphs that overlap as one over the other', () => {
    const image = imageOf(1, 1);
    blendGlyphBitmap(image, half, [10, 20, 30]);
    blendGlyphBitmap(image, half, [10, 20, 30]);

    expect(image.data[3]).toBe(192);
  });

  it('drops the pixels of a bitmap that reach off the image', () => {
    const image = imageOf(1, 1);
    const wide: GlyphBitmap = {
      grid: { left: -1, top: 0, width: 3, height: 1 },
      coverage: Uint8Array.of(9, 255, 9),
    };
    blendGlyphBitmap(image, wide, [0, 0, 0]);

    expect(image.data[3]).toBe(255);
  });
});
