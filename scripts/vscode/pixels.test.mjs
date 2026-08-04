import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { diffMask, inkStats } from './pixels.mjs';

/** Builds a PNG buffer from a `paint(x, y) -> [r,g,b,a]` callback. */
function png(width, height, paint) {
  const image = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b, a] = paint(x, y);
      image.data[i] = r;
      image.data[i + 1] = g;
      image.data[i + 2] = b;
      image.data[i + 3] = a;
    }
  }
  return PNG.sync.write(image);
}

const TRANSPARENT = [0, 0, 0, 0];
const WHITE = [255, 255, 255, 255];
const DARK = [30, 30, 30, 255];

describe('inkStats', () => {
  it('counts pixels that differ from the dominant colour', () => {
    // Four white pixels on a dark field.
    const buffer = png(10, 10, (x, y) => (y === 0 && x < 4 ? WHITE : DARK));
    const stats = inkStats(buffer);
    expect(stats).toMatchObject({
      width: 10,
      height: 10,
      totalPixels: 100,
      inkPixels: 4,
      nonTransparentPixels: 100,
      distinctColors: 2,
      dominantColor: 'rgba(30,30,30,255)',
    });
    expect(stats.dominantShare).toBeCloseTo(0.96, 4);
  });

  it('scores a blank canvas as zero ink whatever its flat colour is', () => {
    expect(inkStats(png(8, 8, () => TRANSPARENT))).toMatchObject({
      inkPixels: 0,
      nonTransparentPixels: 0,
      distinctColors: 1,
      dominantShare: 1,
    });
    expect(inkStats(png(8, 8, () => DARK))).toMatchObject({
      inkPixels: 0,
      nonTransparentPixels: 64,
      distinctColors: 1,
    });
  });

  it('ignores differences at or below the threshold', () => {
    const nearlyDark = [36, 30, 30, 255]; // summed distance 6
    const buffer = png(4, 4, (x, y) => (x === 0 && y === 0 ? nearlyDark : DARK));
    expect(inkStats(buffer).inkPixels).toBe(0);
    expect(inkStats(buffer, 4).inkPixels).toBe(1);
  });
});

describe('diffMask', () => {
  it('reports the pixels present in one capture but not the other', () => {
    const withGlyph = png(6, 6, (x, y) => (x === 2 && y === 3 ? WHITE : DARK));
    const without = png(6, 6, () => DARK);
    const result = diffMask(withGlyph, without);
    expect(result.diffPixels).toBe(1);
    expect(result.bbox).toEqual({ minX: 2, minY: 3, maxX: 2, maxY: 3 });
    expect(result.size).toEqual({ width: 6, height: 6 });
    // The mask marks exactly that pixel white.
    const mask = PNG.sync.read(PNG.sync.write(result.mask));
    expect(mask.data[(3 * 6 + 2) * 4]).toBe(255);
    expect(mask.data[0]).toBe(0);
  });

  it('reports no bounding box for identical captures', () => {
    const buffer = png(4, 4, () => DARK);
    expect(diffMask(buffer, buffer)).toMatchObject({ diffPixels: 0, bbox: null });
  });

  it('refuses captures of different sizes', () => {
    expect(() => diffMask(png(4, 4, () => DARK), png(4, 5, () => DARK))).toThrow(
      /Size mismatch/
    );
  });
});
