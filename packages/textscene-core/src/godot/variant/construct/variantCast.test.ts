import { describe, expect, it } from 'vitest';
import { variant, type Variant } from '../value/variant.js';
import { canConvertStrict, castVariant, colorFromString } from './variantCast.js';

const int = (value: bigint) => variant('INT', value);
const float = (value: number) => variant('FLOAT', value);
const array = (...elements: Variant[]) => variant('ARRAY', elements);
const IDENTITY_BASIS = [1, 0, 0, 0, 1, 0, 0, 0, 1] as const;

describe('canConvertStrict', () => {
  it('allows a listed conversion', () => {
    expect(canConvertStrict('INT', 'FLOAT')).toBe(true);
  });

  it('allows the same type and any type to Nil', () => {
    expect([canConvertStrict('COLOR', 'COLOR'), canConvertStrict('COLOR', 'NIL')]).toEqual([true, true]);
  });

  it('allows Nil only to Object', () => {
    expect([canConvertStrict('NIL', 'OBJECT'), canConvertStrict('NIL', 'INT')]).toEqual([true, false]);
  });

  it('refuses a conversion the strict list leaves out', () => {
    expect(canConvertStrict('STRING', 'INT')).toBe(false);
  });
});

describe('colorFromString', () => {
  it('reads an HTML code', () => {
    expect(colorFromString('#ff000080')).toEqual({ r: 1, g: 0, b: 0, a: Math.fround(128 / 255) });
  });

  it('reads a named colour', () => {
    expect(colorFromString('blue')).toEqual({ r: 0, g: 0, b: 1, a: 1 });
  });

  it('gives Color() for a text that is neither', () => {
    expect(colorFromString('not a colour')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
});

describe('castVariant to a number or a bool', () => {
  it('truncates a float to an int', () => {
    expect([castVariant(float(2.7), 'INT'), castVariant(float(-2.7), 'INT')]).toEqual([int(2n), int(-2n)]);
  });

  it('gives a bool as 1 or 0', () => {
    expect(castVariant(variant('BOOL', true), 'FLOAT')).toEqual(float(1));
  });

  it('gives false for a zero float', () => {
    expect(castVariant(float(-0), 'BOOL')).toEqual(variant('BOOL', false));
  });
});

describe('castVariant to a vector', () => {
  it('keeps the components of a vector of another kind', () => {
    expect(castVariant(variant('VECTOR3I', { x: 1, y: -2, z: 3 }), 'VECTOR3')).toEqual(
      variant('VECTOR3', { x: 1, y: -2, z: 3 })
    );
  });

  it('truncates each component for an integer vector', () => {
    expect(castVariant(variant('VECTOR3', { x: 1.7, y: -1.7, z: 0 }), 'VECTOR3I')).toEqual(
      variant('VECTOR3I', { x: 1, y: -1, z: 0 })
    );
  });

  it('fills the components a smaller vector lacks with zeros', () => {
    expect(castVariant(variant('VECTOR2', { x: 1, y: 2 }), 'VECTOR4')).toEqual(
      variant('VECTOR4', { x: 1, y: 2, z: 0, w: 0 })
    );
  });
});

describe('castVariant to a colour', () => {
  it('reads an int as RGBA8', () => {
    expect(castVariant(int(0xff0000ffn), 'COLOR')).toEqual(variant('COLOR', { r: 1, g: 0, b: 0, a: 1 }));
  });

  it('reads a string as a colour code or name', () => {
    expect(castVariant(variant('STRING', 'red'), 'COLOR')).toEqual(
      variant('COLOR', { r: 1, g: 0, b: 0, a: 1 })
    );
  });
});

describe('castVariant to a rotation or a transform', () => {
  it('gives Quaternion() for a basis that is not a rotation', () => {
    expect(castVariant(variant('BASIS', [2, 0, 0, 0, 2, 0, 0, 0, 2]), 'QUATERNION')).toEqual(
      variant('QUATERNION', { x: 0, y: 0, z: 0, w: 1 })
    );
  });

  it('puts a Transform2D in the xy plane of a Transform3D', () => {
    const transform = variant('TRANSFORM2D', { a: 1, b: 2, c: 3, d: 4, tx: 5, ty: 6 });
    expect(castVariant(transform, 'TRANSFORM3D').value).toEqual({
      basis_x: { x: 1, y: 3, z: 0 },
      basis_y: { x: 2, y: 4, z: 0 },
      basis_z: { x: 0, y: 0, z: 1 },
      origin: { x: 5, y: 6, z: 0 },
    });
  });

  it('gives a basis a zero origin', () => {
    expect(castVariant(variant('BASIS', IDENTITY_BASIS), 'TRANSFORM3D').value).toMatchObject({
      origin: { x: 0, y: 0, z: 0 },
    });
  });
});

describe('castVariant to a packed array', () => {
  it('wraps each int to a byte', () => {
    expect(castVariant(array(int(257n), float(2.9)), 'PACKED_BYTE_ARRAY')).toEqual(
      variant('PACKED_BYTE_ARRAY', [1, 2])
    );
  });

  it('wraps an int to 32 bits', () => {
    expect(castVariant(array(int(2n ** 32n + 5n)), 'PACKED_INT32_ARRAY')).toEqual(
      variant('PACKED_INT32_ARRAY', [5])
    );
  });

  it('gives an element of a type it cannot take the default', () => {
    expect(castVariant(array(int(3n)), 'PACKED_VECTOR2_ARRAY')).toEqual(
      variant('PACKED_VECTOR2_ARRAY', [{ x: 0, y: 0 }])
    );
  });

  it('writes each element as text for a string array', () => {
    expect(castVariant(array(int(1n), variant('BOOL', true)), 'PACKED_STRING_ARRAY')).toEqual(
      variant('PACKED_STRING_ARRAY', ['1', 'true'])
    );
  });
});

describe('castVariant of other types', () => {
  it('keeps a value of the type itself', () => {
    const value = int(4n);
    expect(castVariant(value, 'INT')).toBe(value);
  });

  it('gives an RID its default', () => {
    expect(castVariant(int(4n), 'RID')).toEqual(variant('RID', 0n));
  });

  it('gives the default for a source the operator does not take', () => {
    expect(castVariant(int(1n), 'DICTIONARY')).toEqual(variant('DICTIONARY', []));
    expect(castVariant(variant('QUATERNION', { x: 1, y: 2, z: 3, w: 4 }), 'VECTOR3')).toEqual(
      variant('VECTOR3', { x: 0, y: 0, z: 0 })
    );
    expect(castVariant(variant('FLOAT', 255), 'COLOR')).toEqual(variant('COLOR', { r: 0, g: 0, b: 0, a: 1 }));
    expect(castVariant(int(1n), 'STRING_NAME')).toEqual(variant('STRING_NAME', ''));
  });
});

describe('castVariant to a Projection', () => {
  it('writes the basis rows and the origin row of a Transform3D', () => {
    const transform = {
      basis_x: { x: 1, y: 2, z: 3 },
      basis_y: { x: 4, y: 5, z: 6 },
      basis_z: { x: 7, y: 8, z: 9 },
      origin: { x: 10, y: 11, z: 12 },
    };
    expect(castVariant(variant('TRANSFORM3D', transform), 'PROJECTION').value).toEqual([
      { x: 1, y: 4, z: 7, w: 0 },
      { x: 2, y: 5, z: 8, w: 0 },
      { x: 3, y: 6, z: 9, w: 0 },
      { x: 10, y: 11, z: 12, w: 1 },
    ]);
  });
});
