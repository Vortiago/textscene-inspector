import { describe, expect, it } from 'vitest';
import { dictPackedField, packedFloatCount } from './packedArrayFields';
import { packedArrayForms } from './variantParser';
import { LINEAR_SCAN_CEILING_MS, msToRead, unclosedCalls } from './testing/unclosedCalls';

const VECTOR2_FORMS = packedArrayForms('PackedVector2Array');

describe('dictPackedField', () => {
  const readPoints = dictPackedField('points', 'PackedVector2Array');

  it('reads the value of the key in each spelling', () => {
    expect(readPoints('{"points": PackedVector2Array(1, 2)}')).toBe('PackedVector2Array(1, 2)');
    expect(readPoints('{"points": [Vector2(1, 2)]}')).toBe('[Vector2(1, 2)]');
    expect(readPoints('{"points": Array[Vector2]([Vector2(1, 2)])}')).toBe('Array[Vector2]([Vector2(1, 2)])');
  });

  it('reads nothing for another key or another packed type', () => {
    expect(readPoints('{"tilts": PackedVector2Array(1, 2)}')).toBeNull();
    expect(readPoints('{"points": PackedVector3Array(1, 2, 3)}')).toBeNull();
  });

  it('reads the first key whose value is one of the spellings (edge case)', () => {
    expect(readPoints('{"points": 5, "points": [Vector2(1, 2)]}')).toBe('[Vector2(1, 2)]');
    expect(readPoints('{"points": PackedVector2Array(1, "points": [Vector2(3, 4)]}')).toBe(
      'PackedVector2Array(1, "points": [Vector2(3, 4)'
    );
  });

  it('reads a bracketed value after a packed call that never closes (edge case)', () => {
    expect(readPoints('{"points": [Vector2(1, 2), "points": PackedVector2Array(3, "points": []}')).toBe('[]');
  });

  it.each([
    ['packed', '"points":PackedVector2Array('],
    ['typed', '"points":Array[Vector2](['],
    ['bare', '"points":['],
  ])('reads a crafted value of unclosed %s openers in linear time (edge case)', (_spelling, opener) => {
    const value = unclosedCalls(opener);
    expect(readPoints(value)).toBeNull();
    expect(msToRead(readPoints, value)).toBeLessThan(LINEAR_SCAN_CEILING_MS);
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
