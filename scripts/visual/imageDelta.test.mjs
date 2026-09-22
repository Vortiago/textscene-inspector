/**
 * Unit tests for the comparison metric both image harnesses assert on.
 *
 * The cases that matter are the ones a perceptual (YIQ-distance) metric scores
 * as zero: a flat luminance shift and a chroma-direction shift. Each of those
 * tests computes the YIQ distance inline and asserts it lands under the
 * customary cutoff — so the test states, in arithmetic, the reason this module
 * does not delegate to one.
 */
import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import { compareImages, formatDelta } from './imageDelta.mjs';

/** The pixelmatch/YIQ distance and its `threshold: 0.1` cutoff, for reference. */
const YIQ_MAX_DELTA = 35215 * 0.1 ** 2;
function yiqDelta([r1, g1, b1], [r2, g2, b2]) {
  const y = (r, g, b) => r * 0.29889531 + g * 0.58662247 + b * 0.11448223;
  const i = (r, g, b) => r * 0.59597799 - g * 0.2741761 - b * 0.32180189;
  const q = (r, g, b) => r * 0.21147017 - g * 0.52261711 + b * 0.31114694;
  const dy = y(r1, g1, b1) - y(r2, g2, b2);
  const di = i(r1, g1, b1) - i(r2, g2, b2);
  const dq = q(r1, g1, b1) - q(r2, g2, b2);
  return 0.5053 * dy * dy + 0.299 * di * di + 0.114 * dq * dq;
}

function solidPng(width, height, [r, g, b, a] = [0, 0, 0, 255]) {
  const png = new PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r;
    png.data[i + 1] = g;
    png.data[i + 2] = b;
    png.data[i + 3] = a;
  }
  return png;
}

function buffer(png) {
  return PNG.sync.write(png);
}

describe('compareImages', () => {
  it('reports nothing changed for two identical frames', () => {
    const png = solidPng(4, 4, [93, 99, 110, 255]);
    const result = compareImages(buffer(png), buffer(png));
    expect(result.changedPixels).toBe(0);
    expect(result.changedPct).toBe(0);
    expect(result.maxChannelDelta).toBe(0);
    expect(result.meanChannelError).toBe(0);
  });

  it('counts every pixel of a flat luminance shift a YIQ metric scores as zero', () => {
    const before = [93, 99, 110];
    const after = [82, 88, 98];
    expect(yiqDelta(before, after)).toBeLessThan(YIQ_MAX_DELTA);

    const result = compareImages(
      buffer(solidPng(10, 10, [...before, 255])),
      buffer(solidPng(10, 10, [...after, 255]))
    );
    expect(result.changedPixels).toBe(100);
    expect(result.changedPct).toBe(100);
    expect(result.maxChannelDelta).toBe(12);
  });

  it('counts a chroma-direction shift a YIQ metric scores as zero however large it is', () => {
    // The YIQ distance weights the DIRECTION of a colour change, so along the
    // least-weighted direction it stays under the cutoff at a per-channel
    // excursion of 105/255 — over 40% of the range, scored as no change.
    const before = [140, 120, 150];
    const after = [111, 142, 45];
    expect(yiqDelta(before, after)).toBeLessThan(YIQ_MAX_DELTA);

    const result = compareImages(
      buffer(solidPng(8, 8, [...before, 255])),
      buffer(solidPng(8, 8, [...after, 255]))
    );
    expect(result.changedPct).toBe(100);
    expect(result.maxChannelDelta).toBe(105);
  });

  it('counts a pixel that changed only in alpha, without calling it colour error', () => {
    const expected = solidPng(2, 2, [10, 20, 30, 255]);
    const actual = solidPng(2, 2, [10, 20, 30, 200]);
    const result = compareImages(buffer(expected), buffer(actual));
    expect(result.changedPixels).toBe(4);
    expect(result.maxChannelDelta).toBe(55);
    // The colour channels are untouched, so the parity statistic stays at zero
    // — detection sees alpha, the mean deliberately does not.
    expect(result.meanChannelError).toBe(0);
  });

  it('reports area and magnitude separately for a small, strong change', () => {
    const expected = solidPng(10, 10, [0, 0, 0, 255]);
    const actual = solidPng(10, 10, [0, 0, 0, 255]);
    actual.data[0] = 255;
    const result = compareImages(buffer(expected), buffer(actual));
    expect(result.changedPixels).toBe(1);
    expect(result.changedPct).toBe(1);
    expect(result.maxChannelDelta).toBe(255);
    // Mean error is area-weighted, so a single pixel barely moves it — which
    // is why the gate asserts on the pair and not on this.
    expect(result.meanChannelError).toBeCloseTo(255 / (100 * 3), 6);
  });

  it('reports a size mismatch instead of a number', () => {
    const result = compareImages(buffer(solidPng(4, 4)), buffer(solidPng(4, 5)));
    expect(result.sizeMismatch).toEqual({
      expected: { width: 4, height: 4 },
      actual: { width: 4, height: 5 },
    });
    expect(result.changedPixels).toBeUndefined();
  });

  it('throws on a buffer that is not a PNG', () => {
    expect(() => compareImages(Buffer.from('not a png'), buffer(solidPng(1, 1)))).toThrow();
  });

  it('paints the changed pixels of the diff image, and only those', () => {
    const expected = solidPng(2, 1, [200, 200, 200, 255]);
    const actual = solidPng(2, 1, [200, 200, 200, 255]);
    actual.data[4] = 190;
    const { diff } = compareImages(buffer(expected), buffer(actual), { diff: true });
    // Red, saturated by how far the pixel moved.
    expect(diff.data[4]).toBe(255);
    expect(diff.data[5]).toBeLessThan(200);
    expect(diff.data[5]).toBe(diff.data[6]);
    expect(diff.data[7]).toBe(255);
    // The untouched pixel keeps a faded copy of the baseline, never red.
    expect(diff.data[0]).toBeGreaterThan(230);
    expect(diff.data[0]).toBe(diff.data[1]);
    expect(diff.data[3]).toBe(255);
  });

  it('keeps a 1/255 pixel visible and saturates a large one to full red', () => {
    const expected = solidPng(3, 1, [128, 128, 128, 255]);
    const actual = solidPng(3, 1, [128, 128, 128, 255]);
    actual.data[4] = 129;
    actual.data[8] = 255;
    const { diff } = compareImages(buffer(expected), buffer(actual), { diff: true });
    // A one-count move must not wash out into the backdrop…
    expect(diff.data[5]).toBeLessThan(180);
    // …and must still read as weaker than a full-range one.
    expect(diff.data[5]).toBeGreaterThan(diff.data[9]);
    expect(diff.data[9]).toBe(0);
  });

  it('allocates no diff image unless one is asked for', () => {
    const png = solidPng(2, 2);
    expect(compareImages(buffer(png), buffer(png)).diff).toBeNull();
  });
});

describe('formatDelta', () => {
  it('states area, magnitude and mean for a comparison', () => {
    const expected = solidPng(10, 10, [0, 0, 0, 255]);
    const actual = solidPng(10, 10, [0, 0, 0, 255]);
    actual.data[0] = 8;
    expect(formatDelta(compareImages(buffer(expected), buffer(actual)))).toBe(
      '1 px changed (1.000%), max 8/255, mean 0.027/255'
    );
  });

  it('states both shapes for a size mismatch', () => {
    const result = compareImages(buffer(solidPng(4, 4)), buffer(solidPng(8, 4)));
    expect(formatDelta(result)).toBe('size mismatch: 4x4 vs 8x4');
  });

  it('states a clean comparison as zero rather than omitting it', () => {
    const png = solidPng(3, 3);
    expect(formatDelta(compareImages(buffer(png), buffer(png)))).toBe(
      '0 px changed (0.000%), max 0/255, mean 0.000/255'
    );
  });
});
