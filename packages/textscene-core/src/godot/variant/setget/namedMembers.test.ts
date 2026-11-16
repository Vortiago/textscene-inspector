import { describe, expect, it } from 'vitest';
import { BUILTIN_TYPES } from '../call/builtinTypes.generated';
import { variant, type VariantTypeName } from '../value/variant';
import { VARIANT_TYPE, variantTypeNameOf } from '../variantType';
import { memberNames, memberOf } from './namedMembers';

const vector2 = variant('VECTOR2', { x: 1, y: 2 });

describe('memberOf', () => {
  it('reads a member of a vector', () => {
    expect(memberOf(vector2, 'y')).toEqual(variant('FLOAT', 2));
  });

  it('gives nothing for a name the type does not have', () => {
    expect(memberOf(vector2, 'z')).toBeUndefined();
  });

  it('reads no key off Object.prototype (edge case)', () => {
    expect([memberOf(vector2, 'constructor'), memberOf(vector2, 'toString')]).toEqual([undefined, undefined]);
  });
});

describe('memberNames', () => {
  it.each(Object.keys(VARIANT_TYPE) as VariantTypeName[])(
    'holds each member that Godot 4.6.3 lists for %s, and no other',
    (type) => {
      const listed = BUILTIN_TYPES[variantTypeNameOf(type)]?.members.map(([name]) => name) ?? [];
      expect([...memberNames(type)].sort()).toEqual([...listed].sort());
    }
  );
});
