import { describe, expect, it } from 'vitest';
import { dictPackedField, packedFloatCount } from './packedArrayFields';
import { packedArrayForms } from './variantParser';

const VECTOR2_FORMS = packedArrayForms('PackedVector2Array');

describe('dictPackedField', () => {
  const field = dictPackedField('points', 'PackedVector2Array');

  it('captures the value of the key in each spelling', () => {
    expect(field.exec('{"points": PackedVector2Array(1, 2)}')?.[1]).toBe('PackedVector2Array(1, 2)');
    expect(field.exec('{"points": [Vector2(1, 2)]}')?.[1]).toBe('[Vector2(1, 2)]');
    expect(field.exec('{"points": Array[Vector2]([Vector2(1, 2)])}')?.[1]).toBe(
      'Array[Vector2]([Vector2(1, 2)])'
    );
  });

  it('matches nothing for another key or another packed type', () => {
    expect(field.exec('{"tilts": PackedVector2Array(1, 2)}')).toBeNull();
    expect(field.exec('{"points": PackedVector3Array(1, 2, 3)}')).toBeNull();
  });
});

describe('packedFloatCount', () => {
  it('counts the flat floats of the packed constructor', () => {
    expect(packedFloatCount(VECTOR2_FORMS, 'PackedVector2Array(0, 1, 2, 3, 4)', 2)).toBe(5);
  });

  it('counts one group per element of the bare and typed array spellings', () => {
    expect(packedFloatCount(VECTOR2_FORMS, '[Vector2(0, 1), Vector2(2, 3)]', 2)).toBe(4);
    expect(packedFloatCount(VECTOR2_FORMS, 'Array[Vector2]([Vector2(0, 1)])', 2)).toBe(2);
  });

  it('counts zero for an empty body or a value no spelling matches (edge case)', () => {
    expect(packedFloatCount(VECTOR2_FORMS, 'PackedVector2Array()', 2)).toBe(0);
    expect(packedFloatCount(VECTOR2_FORMS, '5', 2)).toBe(0);
  });

  it('skips the empty part a trailing comma leaves (edge case)', () => {
    expect(packedFloatCount(VECTOR2_FORMS, '[Vector2(0, 1), ]', 2)).toBe(2);
  });
});
