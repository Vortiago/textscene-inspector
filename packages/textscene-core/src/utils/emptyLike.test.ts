import { describe, expect, it } from 'vitest';
import { emptyLike, isPlainPixels } from './emptyLike';

describe('emptyLike', () => {
  it('keeps half-float bits as a Uint16Array of the asked length', () => {
    const empty = emptyLike(Uint16Array.of(1, 2), 3);
    expect([empty instanceof Uint16Array, [...empty]]).toEqual([true, [0, 0, 0]]);
  });

  it('keeps floats as a Float32Array', () => {
    expect(emptyLike(Float32Array.of(1), 1)).toBeInstanceOf(Float32Array);
  });

  it('puts clamped bytes in a plain Uint8Array (edge case)', () => {
    expect(emptyLike(Uint8ClampedArray.of(1), 1).constructor).toBe(Uint8Array);
  });
});

describe('isPlainPixels', () => {
  it('holds for bytes, half-float bits and floats', () => {
    expect([Uint8Array.of(1), Uint16Array.of(1), Float32Array.of(1)].map(isPlainPixels)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('fails for clamped bytes, which emptyLike turns into plain bytes (edge case)', () => {
    expect(isPlainPixels(Uint8ClampedArray.of(1))).toBe(false);
  });
});
