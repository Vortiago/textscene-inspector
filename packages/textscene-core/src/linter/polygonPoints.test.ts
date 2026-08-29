/**
 * `polygonPointCount` over every spelling a packed slot takes, since a rule that
 * only reads the constructor goes silent on the two the validator also blesses.
 */

import { describe, it, expect } from 'vitest';
import { polygonPointCount } from './polygonPoints';

describe('polygonPointCount', () => {
  it('reads an absent key as the PackedVector2Array() default: zero points', () => {
    expect(polygonPointCount(undefined)).toBe(0);
  });

  it('counts coordinate PAIRS in the packed constructor', () => {
    expect(polygonPointCount('PackedVector2Array(0, 0, 1, 0, 1, 1)')).toBe(3);
    expect(polygonPointCount('PackedVector2Array()')).toBe(0);
  });

  it('drops a trailing odd component, which is not a whole vertex', () => {
    expect(polygonPointCount('PackedVector2Array(0, 0, 1)')).toBe(1);
  });

  it('counts ELEMENTS in the bare array spelling', () => {
    expect(polygonPointCount('[Vector2(0, 0), Vector2(1, 0)]')).toBe(2);
    expect(polygonPointCount('[]')).toBe(0);
  });

  it('counts ELEMENTS in the typed Array[Vector2] spelling', () => {
    expect(polygonPointCount('Array[Vector2]([Vector2(0, 0), Vector2(1, 0), Vector2(1, 1)])')).toBe(
      3
    );
  });

  it('ignores the trailing comma Godot loads as no extra element', () => {
    expect(polygonPointCount('[Vector2(0, 0), Vector2(1, 0),]')).toBe(2);
  });

  it('counts a non-finite component like any other, which is what Godot loads', () => {
    expect(polygonPointCount('[Vector2(inf, 0), Vector2(1, 0)]')).toBe(2);
    expect(polygonPointCount('PackedVector2Array(inf, 0, 1, 0)')).toBe(2);
  });

  it('returns null for a value no packed spelling matches', () => {
    expect(polygonPointCount('Vector2(0, 0)')).toBeNull();
    expect(polygonPointCount('nonsense')).toBeNull();
    expect(polygonPointCount('')).toBeNull();
  });
});
