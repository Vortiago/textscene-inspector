/**
 * The shape decoders over the three spellings a packed slot takes. The packed
 * constructor's body is a FLAT argument list; the bare and typed bodies hold one
 * ELEMENT per comma, and both flatten to the same components.
 *
 * A decoder narrower than the validator beside it lints clean and then draws
 * nothing: the caller catches the throw and keeps an empty array.
 */

import { describe, it, expect } from 'vitest';
import {
  parsePackedColorArray,
  parsePackedVector2Array,
  parsePackedVector3Array,
} from './packedArray';

describe('parsePackedVector2Array', () => {
  it('reads the bare array spelling', () => {
    expect(Array.from(parsePackedVector2Array('[Vector2(0, 0), Vector2(5, 5)]'))).toEqual([
      0, 0, 5, 5,
    ]);
  });

  it('reads the typed Array[Vector2] spelling', () => {
    expect(
      Array.from(parsePackedVector2Array('Array[Vector2]([Vector2(1, 2), Vector2(3, 4)])'))
    ).toEqual([1, 2, 3, 4]);
  });

  it('reads an empty bare array as no vertices', () => {
    expect(parsePackedVector2Array('[]')).toHaveLength(0);
    expect(parsePackedVector2Array('Array[Vector2]([])')).toHaveLength(0);
  });

  it('takes the trailing comma Godot loads as no extra element', () => {
    expect(Array.from(parsePackedVector2Array('[Vector2(0, 0), Vector2(1, 0),]'))).toEqual([
      0, 0, 1, 0,
    ]);
  });

  it('throws on an element of the wrong arity, a conversion Godot does not make', () => {
    expect(() => parsePackedVector2Array('[Vector3(0, 0, 0)]')).toThrow(
      'Invalid PackedVector2Array format'
    );
    expect(() => parsePackedVector2Array('[Vector2(0, 0, 0)]')).toThrow(
      'Invalid PackedVector2Array format'
    );
  });

  it('throws on an element component the tokenizer refuses', () => {
    expect(() => parsePackedVector2Array('[Vector2(0, 0), Vector2(1.2.3, 0)]')).toThrow(
      'Invalid number in PackedVector2Array'
    );
  });

  it('throws on a non-finite element component, undrawable in every spelling', () => {
    expect(() => parsePackedVector2Array('[Vector2(inf, 0)]')).toThrow(
      'Invalid number in PackedVector2Array'
    );
  });

  it('throws on a value no spelling matches', () => {
    expect(() => parsePackedVector2Array('Vector2(0, 0)')).toThrow(
      'Invalid PackedVector2Array format'
    );
  });
});

describe('parsePackedVector3Array', () => {
  it('reads the bare array spelling', () => {
    expect(Array.from(parsePackedVector3Array('[Vector3(1, 2, 3), Vector3(4, 5, 6)]'))).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it('reads the typed Array[Vector3] spelling', () => {
    expect(Array.from(parsePackedVector3Array('Array[Vector3]([Vector3(1, 2, 3)])'))).toEqual([
      1, 2, 3,
    ]);
  });

  it('throws on a value no spelling matches', () => {
    expect(() => parsePackedVector3Array('PackedVector2Array(0, 0)')).toThrow(
      'Invalid PackedVector3Array format'
    );
  });
});

describe('parsePackedColorArray', () => {
  it('reads the bare array spelling', () => {
    expect(Array.from(parsePackedColorArray('[Color(1, 0, 0, 1), Color(0, 1, 0, 1)]'))).toEqual([
      1, 0, 0, 1, 0, 1, 0, 1,
    ]);
  });

  it('reads the typed Array[Color] spelling', () => {
    expect(Array.from(parsePackedColorArray('Array[Color]([Color(0.5, 0.25, 0, 1)])'))).toEqual([
      0.5, 0.25, 0, 1,
    ]);
  });

  it('throws on a value no spelling matches', () => {
    expect(() => parsePackedColorArray('Color(1, 1, 1, 1)')).toThrow(
      'Invalid PackedColorArray format'
    );
  });
});
