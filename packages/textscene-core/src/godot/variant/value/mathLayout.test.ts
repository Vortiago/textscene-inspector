import { describe, expect, it } from 'vitest';
import { variant } from './variant.js';
import {
  componentsOf,
  isMathType,
  MATH_LAYOUT,
  MATH_TYPES,
  packedComponents,
  structOf,
} from './mathLayout.js';

describe('MATH_LAYOUT', () => {
  it('gives each math type back from its components, in its count', () => {
    for (const type of MATH_TYPES) {
      const components = Array.from({ length: MATH_LAYOUT[type].count }, (_, index) => index + 1);
      expect(componentsOf(structOf(type, components)), type).toEqual(components);
    }
  });

  it('lays a struct out in the memory order Godot writes it', () => {
    const transform = variant('TRANSFORM3D', {
      basis_x: { x: 1, y: 2, z: 3 },
      basis_y: { x: 4, y: 5, z: 6 },
      basis_z: { x: 7, y: 8, z: 9 },
      origin: { x: 10, y: 11, z: 12 },
    });
    expect(componentsOf(transform)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(componentsOf(variant('PLANE', { normal: { x: 1, y: 2, z: 3 }, d: 4 }))).toEqual([1, 2, 3, 4]);
    expect(componentsOf(variant('RECT2I', { x: 1, y: 2, w: 3, h: 4 }))).toEqual([1, 2, 3, 4]);
  });

  it('keeps the int types int32 and Color float', () => {
    expect(MATH_LAYOUT.VECTOR3I.component).toBe('int32');
    expect(MATH_LAYOUT.COLOR.component).toBe('float');
    expect(MATH_LAYOUT.BASIS.component).toBe('real');
  });
});

describe('isMathType', () => {
  it('knows a struct type and refuses a scalar or a container', () => {
    expect(isMathType('PROJECTION')).toBe(true);
    expect(isMathType('FLOAT')).toBe(false);
    expect(isMathType('PACKED_VECTOR2_ARRAY')).toBe(false);
  });

  it('refuses a name only the object prototype has (edge case)', () => {
    expect(isMathType('toString')).toBe(false);
  });
});

describe('packedComponents', () => {
  it('joins the components of every element in order', () => {
    const colors = [
      { r: 1, g: 2, b: 3, a: 4 },
      { r: 5, g: 6, b: 7, a: 8 },
    ];
    expect(packedComponents('PACKED_COLOR_ARRAY', colors)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('gives no components for an empty array (edge case)', () => {
    expect(packedComponents('PACKED_VECTOR3_ARRAY', [])).toEqual([]);
  });
});
