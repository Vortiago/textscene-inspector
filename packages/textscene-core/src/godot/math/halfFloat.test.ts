import { describe, expect, it } from 'vitest';
import { halfToFloat, makeHalfFloat } from './halfFloat.js';

// Each pair is Godot 4.6.3's `encode_half` then `decode_u16`, and `decode_half`, of the value.
const GODOT_HALVES: readonly (readonly [number, number, number])[] = [
  [Number.NaN, 32767, Number.NaN],
  [Infinity, 31744, Infinity],
  [-Infinity, 64512, -Infinity],
  [1, 15360, 1],
  [-2.5, 49408, -2.5],
  [65504, 31743, 65504],
  [65520, 31743, 65504],
  [1e-5, 0, 0],
  [6.1e-5, 0, 0],
  [6.104e-5, 1024, 0.00006103515625],
  [1.00097656, 15361, 1.0009765625],
  [1.0009, 15360, 1],
  [0.1, 11878, 0.0999755859375],
];

describe('makeHalfFloat', () => {
  it.each(GODOT_HALVES)('gives the half bits Godot gives for %d', (value, half) => {
    expect(makeHalfFloat(value)).toBe(half);
  });
});

describe('halfToFloat', () => {
  it.each(GODOT_HALVES)('reads back the float Godot reads for %d', (_value, half, float) => {
    expect(halfToFloat(half)).toBe(float);
  });

  it('reads a denormal half', () => {
    expect(halfToFloat(1)).toBe(2 ** -24);
  });
});
