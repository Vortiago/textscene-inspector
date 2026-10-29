import { describe, expect, it } from 'vitest';
import {
  vector2Add,
  vector2Length,
  vector2Scaled,
  vector2Sub,
  vector3Add,
  vector3Div,
  vector3Mul,
  vector3Sub,
  normalizedVector2,
  normalizedVector3,
  vector3NormalizeInto,
  vector3Cross,
  vector3Dot,
  vector3Lerp,
  vector3Maxf,
} from './vector';
import { storedReal } from './real';

describe('normalizedVector2', () => {
  it('scales a vector to unit length in single precision', () => {
    expect(normalizedVector2({ x: 3, y: -4 })).toEqual({ x: Math.fround(0.6), y: Math.fround(-0.8) });
  });

  it('leaves a zero vector zero, as Vector2::normalize does (edge case)', () => {
    expect(normalizedVector2({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe('normalizedVector3', () => {
  it('scales a vector to unit length', () => {
    expect(normalizedVector3(3, 0, 4)).toEqual([Math.fround(0.6), 0, Math.fround(0.8)]);
  });

  it('keeps a negative component negative', () => {
    expect(normalizedVector3(0, -2, 0)).toEqual([0, -1, 0]);
  });

  it('leaves a zero vector zero, as Vector3::normalize does (edge case)', () => {
    expect(normalizedVector3(0, 0, 0)).toEqual([0, 0, 0]);
  });
});

describe('vector3NormalizeInto', () => {
  it('writes the unit vector into the one it is given', () => {
    const out = { x: 9, y: 9, z: 9 };

    expect(vector3NormalizeInto(out, 3, 0, 4)).toBe(out);
    expect(out).toEqual({ x: Math.fround(0.6), y: 0, z: Math.fround(0.8) });
  });

  it('writes zero for a zero vector (edge case)', () => {
    expect(vector3NormalizeInto({ x: 9, y: 9, z: 9 }, 0, 0, 0)).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('vector3Dot', () => {
  it('sums the products of the components', () => {
    expect(vector3Dot([1, 2, 3], [4, 5, 6])).toBe(32);
  });

  it('rounds each product and sum to single precision', () => {
    // In double precision 0.1 * 3 + 0 + 0 is 0.30000000000000004, not the float of 0.3.
    expect(vector3Dot([0.1, 0, 0], [3, 0, 0])).toBe(Math.fround(Math.fround(0.1) * 3));
  });
});

describe('vector3Cross', () => {
  it('turns +X and +Y into +Z', () => {
    expect(vector3Cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
  });

  it('turns two parallel vectors into zero', () => {
    expect(vector3Cross([1, 2, 3], [2, 4, 6])).toEqual([0, 0, 0]);
  });
});

describe('vector3Maxf', () => {
  it('raises each component below the floor to it, on its own', () => {
    expect(vector3Maxf({ x: 0.5, y: -3, z: 7 }, 1)).toEqual({ x: 1, y: 1, z: 7 });
  });
});

describe('vector3Lerp', () => {
  it('moves each component the given share of the way, in single precision', () => {
    expect(vector3Lerp({ x: 1, y: 2, z: 3 }, { x: -1, y: 0.5, z: 4 }, 0.35)).toEqual({
      x: Math.fround(0.3),
      y: Math.fround(1.475),
      z: Math.fround(3.35),
    });
  });

  it('extrapolates past the end for a weight above one (edge case)', () => {
    expect(vector3Lerp({ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 3 }, 2)).toEqual({ x: 2, y: 4, z: 6 });
  });
});

describe('component-wise Vector3 arithmetic', () => {
  const a = { x: 0.1, y: 2, z: -3 };
  const b = { x: 0.2, y: 4, z: 0.5 };

  it('adds, subtracts, multiplies and divides each component, rounded to float', () => {
    expect(vector3Add(a, b)).toEqual({ x: Math.fround(0.1 + 0.2), y: 6, z: -2.5 });
    expect(vector3Sub(a, b)).toEqual({ x: Math.fround(0.1 - 0.2), y: -2, z: -3.5 });
    expect(vector3Mul(a, b)).toEqual({ x: Math.fround(0.1 * 0.2), y: 8, z: -1.5 });
    expect(vector3Div(a, b)).toEqual({ x: Math.fround(0.1 / 0.2), y: 0.5, z: -6 });
  });

  it('divides by zero to an infinity, as float division does (edge case)', () => {
    expect(vector3Div({ x: 1, y: -1, z: 0 }, { x: 0, y: 0, z: 0 }).y).toBe(-Infinity);
  });
});

// The expected numbers are Godot 4.6.3's float `Vector2`
// (/mnt/project-files/cpuparticles2d-995/transform-oracle.gd).
describe('component-wise Vector2 arithmetic', () => {
  const a = { x: storedReal(0.1), y: storedReal(0.7) };
  const b = { x: storedReal(0.2), y: storedReal(0.3) };

  it('adds and subtracts each component, rounded to float', () => {
    expect(vector2Add(a, b)).toEqual({ x: storedReal(0.300000011921), y: 1 });
    expect(vector2Sub(a, b)).toEqual({ x: storedReal(-0.10000000149), y: storedReal(0.399999976158) });
  });

  it('scales each component by a real_t', () => {
    expect(vector2Scaled(a, storedReal(0.3))).toEqual({
      x: storedReal(0.030000001192),
      y: storedReal(0.210000008345),
    });
  });

  it('measures the length in float', () => {
    expect(vector2Length({ x: storedReal(3.3), y: storedReal(-4.7) })).toBe(storedReal(5.742821216583));
  });
});
