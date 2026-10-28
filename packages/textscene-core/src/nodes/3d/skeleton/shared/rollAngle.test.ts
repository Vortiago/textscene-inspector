import { describe, expect, it } from 'vitest';
import { quaternionFromAxisAngle } from '../../../../godot/math/quaternion';
import { rollAngle } from './rollAngle';

const X = { x: 1, y: 0, z: 0 };
const Z = { x: 0, y: 0, z: 1 };

describe('rollAngle', () => {
  it('reads the whole angle of a turn about the roll axis', () => {
    expect(rollAngle(quaternionFromAxisAngle(Z, 0.9), Z)).toBeCloseTo(0.9, 6);
  });

  it('reads the signed angle of a turn the other way', () => {
    expect(rollAngle(quaternionFromAxisAngle(Z, -0.9), Z)).toBeCloseTo(-0.9, 6);
  });

  it('reads nothing of a turn about a perpendicular axis (edge case)', () => {
    expect(rollAngle(quaternionFromAxisAngle(X, 0.9), Z)).toBe(0);
  });

  it('wraps an angle past a half turn into (-pi, pi] (`symmetrize_angle`)', () => {
    expect(rollAngle(quaternionFromAxisAngle(Z, 4), Z)).toBeCloseTo(4 - 2 * Math.PI, 6);
  });
});
