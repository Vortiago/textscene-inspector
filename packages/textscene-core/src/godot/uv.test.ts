import { describe, expect, it } from 'vitest';
import { bottomUpV } from './uv';

describe('bottomUpV', () => {
  it('puts the image’s top row, Godot’s V = 0, at the top of a bottom-up upload', () => {
    expect(bottomUpV(0)).toBe(1);
    expect(bottomUpV(0.25)).toBe(0.75);
  });

  it('turns a V back, as its own inverse', () => {
    expect(bottomUpV(bottomUpV(0.3))).toBeCloseTo(0.3, 12);
  });

  it('keeps a V outside 0 to 1, which a repeating texture wraps (edge case)', () => {
    expect(bottomUpV(1.5)).toBe(-0.5);
  });
});
