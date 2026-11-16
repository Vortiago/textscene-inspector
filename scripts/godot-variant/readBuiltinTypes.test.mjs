import { describe, expect, it } from 'vitest';
import { builtinTypes } from './readBuiltinTypes.mjs';

const API = {
  builtin_classes: [
    {
      name: 'Vector2',
      is_keyed: false,
      indexing_return_type: 'float',
      members: [{ name: 'x', type: 'float' }],
      methods: [
        { name: 'angle', return_type: 'float', is_vararg: false, is_const: true, is_static: false, hash: 7 },
        {
          name: 'from_angle',
          return_type: 'Vector2',
          is_vararg: false,
          is_const: false,
          is_static: true,
          hash: 9,
          arguments: [{ name: 'angle', type: 'float', default_value: '0' }],
        },
      ],
    },
    { name: 'Nil', is_keyed: false },
  ],
};

describe('builtinTypes', () => {
  it('reads a method as its name, return type, flags, hash and argument types with defaults', () => {
    const [vector2] = builtinTypes(API);
    expect(vector2.methods).toEqual([
      ['angle', 'float', 1, 7, []],
      ['from_angle', 'Vector2', 2, 9, [['float', '0']]],
    ]);
  });

  it('reads a type with no members, indexing or methods as empty', () => {
    expect(builtinTypes(API)[1]).toEqual({
      name: 'Nil',
      members: [],
      indexing: '',
      isKeyed: false,
      methods: [],
    });
  });
});
