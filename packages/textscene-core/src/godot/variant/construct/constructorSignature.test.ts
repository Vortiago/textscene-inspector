import { describe, expect, it } from 'vitest';
import { constructorSignature, CONSTRUCTORS_OF_TYPE } from './constructorSignature.js';

describe('constructorSignature', () => {
  it('reads a plain constructor of its argument types', () => {
    const signature = constructorSignature(
      ['VariantConstructor', ['Vector2', 'double', 'double']] as never,
      4
    );
    expect(signature).toEqual({
      index: 4,
      constructor: 'VariantConstructor',
      type: 'VECTOR2',
      arguments: ['FLOAT', 'FLOAT'],
    });
  });

  it('throws on a constructor class it does not know', () => {
    expect(() => constructorSignature(['VariantConstructorNew', []] as never, 0)).toThrow(
      'expected a known constructor class, got VariantConstructorNew'
    );
  });

  it('lists the no-argument constructor of a type first', () => {
    expect(CONSTRUCTORS_OF_TYPE.get('VECTOR3')?.[0]?.arguments).toEqual([]);
  });
});
