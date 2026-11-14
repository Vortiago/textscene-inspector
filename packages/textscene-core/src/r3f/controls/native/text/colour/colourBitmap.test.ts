import { describe, expect, it } from 'vitest';
import type { BitmapGrid } from '../ftGrays';
import type { GlyphBitmap } from '../glyphCoverage';
import { blendColrLayers, type ColourBitmap } from './colourBitmap';
import type { BgraColour } from './cpal';

const OPAQUE_RED: BgraColour = [0, 0, 255, 255];
const HALF_BLUE: BgraColour = [255, 0, 0, 128];

/** A layer bitmap on `grid` with every pixel at `level`. */
function covered(grid: BitmapGrid, level: number): GlyphBitmap {
  return { grid, coverage: new Uint8Array(grid.width * grid.height).fill(level) };
}

/** The red, green, blue and alpha of the texel at `(column, row)`. */
function texelAt({ grid, texels }: ColourBitmap, column: number, row: number): number[] {
  const at = (row * grid.width + column) * 4;
  return [...texels.subarray(at, at + 4)];
}

const ONE_PIXEL: BitmapGrid = { left: 0, top: -1, width: 1, height: 1 };

describe('blendColrLayers', () => {
  it('lays a covered pixel of the first layer in its colour, red first', () => {
    const bitmap = blendColrLayers([{ coverage: covered(ONE_PIXEL, 255), colour: OPAQUE_RED }]);

    expect(texelAt(bitmap!, 0, 0)).toEqual([255, 0, 0, 255]);
  });

  it('premultiplies the colour by the alpha of the layer and its coverage, truncating each step', () => {
    const bitmap = blendColrLayers([{ coverage: covered(ONE_PIXEL, 128), colour: HALF_BLUE }]);

    // FreeType: alpha 128 * 128 / 255 = 64, blue 255 * 64 / 255 = 64.
    expect(texelAt(bitmap!, 0, 0)).toEqual([0, 0, 64, 64]);
  });

  it('lays a later layer over an earlier one, as FreeType blends it in integers', () => {
    const bitmap = blendColrLayers([
      { coverage: covered(ONE_PIXEL, 255), colour: OPAQUE_RED },
      { coverage: covered(ONE_PIXEL, 255), colour: HALF_BLUE },
    ]);

    // Kept 255 - 128 = 127: red 255 * 127 / 255 = 127, blue 255 * 128 / 255 = 128, alpha 127 + 128.
    expect(texelAt(bitmap!, 0, 0)).toEqual([127, 0, 128, 255]);
  });

  it('widens the grid to cover a later layer, and keeps the earlier texels at their place', () => {
    const bitmap = blendColrLayers([
      { coverage: covered(ONE_PIXEL, 255), colour: OPAQUE_RED },
      { coverage: covered({ left: 2, top: -3, width: 1, height: 1 }, 255), colour: [255, 0, 0, 255] },
    ])!;

    expect(bitmap.grid).toEqual({ left: 0, top: -3, width: 3, height: 3 });
    expect(texelAt(bitmap, 0, 2)).toEqual([255, 0, 0, 255]);
    expect(texelAt(bitmap, 2, 0)).toEqual([0, 0, 255, 255]);
    expect(texelAt(bitmap, 1, 1)).toEqual([0, 0, 0, 0]);
  });

  it('takes its grid from the first layer that covers a pixel', () => {
    const empty: GlyphBitmap = {
      grid: { left: 0, top: 0, width: 0, height: 0 },
      coverage: new Uint8Array(0),
    };
    const grid: BitmapGrid = { left: 4, top: -5, width: 2, height: 2 };

    const bitmap = blendColrLayers([
      { coverage: empty, colour: OPAQUE_RED },
      { coverage: covered(grid, 255), colour: OPAQUE_RED },
    ]);

    expect(bitmap?.grid).toEqual(grid);
  });

  it('widens the grid to the glyph origin for an empty layer after one that covers a pixel', () => {
    const empty: GlyphBitmap = {
      grid: { left: 0, top: 0, width: 0, height: 0 },
      coverage: new Uint8Array(0),
    };

    const bitmap = blendColrLayers([
      { coverage: covered({ left: 4, top: -5, width: 2, height: 2 }, 255), colour: OPAQUE_RED },
      { coverage: empty, colour: OPAQUE_RED },
    ]);

    expect(bitmap?.grid).toEqual({ left: 0, top: -5, width: 6, height: 5 });
  });

  it('covers no pixel for layers that cover none', () => {
    const empty: GlyphBitmap = {
      grid: { left: 0, top: 0, width: 0, height: 0 },
      coverage: new Uint8Array(0),
    };

    expect(blendColrLayers([{ coverage: empty, colour: OPAQUE_RED }])).toBeNull();
  });
});
