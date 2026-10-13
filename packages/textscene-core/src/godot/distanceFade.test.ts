import { describe, expect, it } from 'vitest';
import { distanceFade } from './distanceFade';

describe('distanceFade', () => {
  it('is full strength up to `begin`', () => {
    expect(distanceFade(2.5, 4, 2)).toBe(1);
    expect(distanceFade(2.5, 4, 2.5)).toBe(1);
  });

  it('smoothsteps between `begin` and `begin + length`', () => {
    // smoothstep(0, 1, 1 - (d - begin) / length): at the midpoint the argument is 0.5, which maps
    // to 0.5, and a quarter in it is 0.75, which maps to 0.75² × (3 - 1.5) = 0.84375.
    expect(distanceFade(2.5, 4, 4.5)).toBeCloseTo(0.5, 6);
    expect(distanceFade(2.5, 4, 3.5)).toBeCloseTo(0.84375, 6);
  });

  it('is zero beyond `begin + length`', () => {
    expect(distanceFade(2.5, 4, 7)).toBe(0);
  });

  it('cuts at `begin` when the length is zero instead of dividing by it', () => {
    expect(distanceFade(2.5, 0, 2.4)).toBe(1);
    expect(distanceFade(2.5, 0, 2.6)).toBe(0);
  });
});
