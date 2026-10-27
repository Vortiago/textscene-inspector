import { describe, expect, it } from 'vitest';
import { emptyLike } from './emptyLike';

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
