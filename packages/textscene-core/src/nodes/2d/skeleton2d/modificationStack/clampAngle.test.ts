import { describe, expect, it } from 'vitest';
import { clampAngle } from './clampAngle';

describe('clampAngle', () => {
  // Each expected value is what `clamp_angle` returns in Godot 4.6.3.
  it.each([
    [-0.5, 0.2, 1.0, false, 0.2],
    [2.0, 0.2, 1.0, false, 1.0],
    [0.5, 0.2, 1.0, true, 0.2],
    [4.0, -1.0, 1.0, false, 4.0],
    [0.1, 1.0, 0.2, false, 0.2],
    [0.6, 0.2, 1.0, false, 0.6],
  ])('clamps %f between %f and %f, inverted %s, to %f', (angle, min, max, invert, expected) => {
    expect(clampAngle(angle, { min, max, invert })).toBeCloseTo(expected, 6);
  });
});
