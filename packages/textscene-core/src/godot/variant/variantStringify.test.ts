import { describe, expect, it } from 'vitest';
import { strToVar } from './strToVar';
import { stringify } from './variantStringify';

// Each expected text is what Godot 4.6.3 prints for `str(str_to_var(input))`.
const str = (input: string) => stringify(strToVar(input));

describe('stringify', () => {
  it('writes a vector of reals with six significant decimals and a point on each whole number', () => {
    expect(str('Vector3(0.1, -0, 1e20)')).toBe('(0.1, 0.0, 100000002004087734272.0)');
  });

  it('writes a quaternion without the point on a whole number', () => {
    expect(str('Quaternion(0, 0, 0.7071068, 0.7071068)')).toBe('(0, 0, 0.707107, 0.707107)');
  });

  it('writes a basis and a transform by their columns', () => {
    expect(str('Basis(0, 1, 0, -1, 0, 0, 0, 0, 1)')).toBe(
      '[X: (0.0, -1.0, 0.0), Y: (1.0, 0.0, 0.0), Z: (0.0, 0.0, 1.0)]'
    );
    expect(str('Transform2D(1, 0, 0, 1, 5, 6)')).toBe('[X: (1.0, 0.0), Y: (0.0, 1.0), O: (5.0, 6.0)]');
  });

  it('writes a packed float32 element with the fourteen decimals of a double', () => {
    expect(str('PackedFloat32Array(0.1, 2)')).toBe('[0.10000000149012, 2.0]');
  });

  it('quotes a string inside a container and keeps a dictionary in its order', () => {
    expect(str('[1, 2.5, "x", null]')).toBe('[1, 2.5, "x", <null>]');
    expect(str('{"b": 1, "a": 2, 3: 4}')).toBe('{ "b": 1, "a": 2, 3: 4 }');
  });

  it('writes a small float in fixed notation', () => {
    expect(str('1e-7')).toBe('0.0000001');
  });
});

describe('stringify of a Color, whose components print with four decimals', () => {
  it('rounds an exact tie to even, as printf does', () => {
    expect(str('Color(0.03125, 0.09375, 2.5, 1)')).toBe('(0.0312, 0.0938, 2.5, 1.0)');
  });

  it('writes the named numbers by name', () => {
    expect(str('Color(nan, inf, -inf, 1)')).toBe('(nan, inf, -inf, 1.0)');
  });
});
