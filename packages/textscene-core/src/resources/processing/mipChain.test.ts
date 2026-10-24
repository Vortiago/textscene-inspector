/**
 * Each expected level is the bytes Godot 4.6.3 gives: `Image.generate_mipmaps` on the same RGBA8
 * bytes, or the texture importer's output for the normal map.
 */
import { describe, expect, it } from 'vitest';
import { mipChain, mipSize } from './mipChain';

function levelBytes(base: number[], width: number, height: number, renormalize = false): number[][] {
  return mipChain({ data: new Uint8Array(base), width, height }, renormalize).map((level) => [...level.data]);
}

describe('mipSize', () => {
  it('halves the side once per level', () => {
    expect([0, 1, 2].map((level) => mipSize(256, level))).toEqual([256, 128, 64]);
  });

  it('stops at one texel past the last halving (edge case)', () => {
    expect(mipSize(256, 12)).toBe(1);
  });

  it('keeps an empty side at one texel (error case)', () => {
    expect(mipSize(0, 0)).toBe(1);
  });
});

describe('mipChain', () => {
  it('averages each 2 × 2 block in byte space, rounding half up', () => {
    const base = [
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 10, 20, 30, 40, 200, 100, 50, 0, 1, 2, 3, 4,
    ];
    expect(levelBytes(base, 3, 2)).toEqual([base, [116, 94, 20, 138]]);
  });

  it('halves each odd size down, dropping the last column and row', () => {
    const base = Array.from({ length: 5 * 3 * 4 }, (_, i) => (i * 37) % 256);
    expect(levelBytes(base, 5, 3).slice(1)).toEqual([
      [124, 97, 134, 107, 100, 137, 110, 83],
      [112, 117, 122, 95],
    ]);
  });

  it('gives each level its size, down to 1 × 1', () => {
    const sizes = mipChain({ data: new Uint8Array(8 * 2 * 4), width: 8, height: 2 }, false).map(
      ({ width, height }) => `${width}x${height}`
    );
    expect(sizes).toEqual(['8x2', '4x1', '2x1', '1x1']);
  });

  it('averages a one-texel-wide column down its rows only (edge case)', () => {
    const base = [0, 0, 0, 0, 255, 255, 255, 255, 1, 2, 3, 4, 9, 9, 9, 9];
    expect(levelBytes(base, 1, 4).slice(1)).toEqual([
      [128, 128, 128, 128, 5, 6, 6, 7],
      [67, 67, 67, 68],
    ]);
  });

  it('renormalises the normal of each level it generates', () => {
    const base = [
      128, 128, 128, 255, 255, 255, 255, 255, 200, 128, 128, 255, 0, 0, 0, 255, 100, 30, 240, 255, 128, 128,
      255, 255, 250, 128, 140, 255, 64, 200, 180, 255,
    ];
    expect(levelBytes(base, 2, 4, true)).toEqual([
      base,
      [255, 131, 131, 255, 142, 118, 254, 255],
      [221, 124, 214, 255],
    ]);
  });

  it('leaves a 1 × 1 image as its only level, unrenormalised (edge case)', () => {
    expect(levelBytes([1, 2, 3, 4], 1, 1, true)).toEqual([[1, 2, 3, 4]]);
  });

  it('refuses bytes that do not hold width × height RGBA8 texels (error case)', () => {
    expect(() => mipChain({ data: new Uint8Array(12), width: 2, height: 2 }, false)).toThrow(
      'expected 16 bytes for a 2x2 RGBA8 image, got 12'
    );
  });
});
