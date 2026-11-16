import { describe, expect, it } from 'vitest';
import { variantTypeOfCpp } from './cppType.js';

describe('variantTypeOfCpp', () => {
  it('reads a C++ alias and a Variant name the C++ spells the same', () => {
    expect(variantTypeOfCpp('double')).toBe('FLOAT');
    expect(variantTypeOfCpp('::AABB')).toBe('AABB');
    expect(variantTypeOfCpp('Vector2')).toBe('VECTOR2');
  });

  it('refuses a Variant name the C++ spells another way (error case)', () => {
    for (const name of ['Nil', 'int', 'float', 'AABB', 'RID'])
      expect(() => variantTypeOfCpp(name)).toThrow(`expected a Variant C++ type, got ${name}`);
  });

  it('refuses a name that is no type (edge case)', () => {
    expect(() => variantTypeOfCpp('toString')).toThrow('expected a Variant C++ type, got toString');
  });
});
