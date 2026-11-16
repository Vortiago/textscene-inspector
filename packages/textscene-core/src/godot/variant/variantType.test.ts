import { describe, expect, it } from 'vitest';
import { variantTypeOfName } from './variantType';

describe('variantTypeOfName', () => {
  it('reads the engine name of a type', () => {
    expect(variantTypeOfName('Vector2i')).toBe('VECTOR2I');
    expect(variantTypeOfName('PackedVector4Array')).toBe('PACKED_VECTOR4_ARRAY');
  });

  it('gives nothing for a C++ scalar or a class name, which is not a Variant type name', () => {
    expect(variantTypeOfName('float')).toBe('FLOAT');
    expect(variantTypeOfName('Node')).toBeUndefined();
    expect(variantTypeOfName('vector2')).toBeUndefined();
  });
});
