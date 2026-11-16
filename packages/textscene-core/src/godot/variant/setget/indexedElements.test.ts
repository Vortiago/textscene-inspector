import { describe, expect, it } from 'vitest';
import { BUILTIN_TYPES } from '../call/builtinTypes.generated';
import { textToVariant } from '../reader/variantReader';
import { variant } from '../value/variant';
import { indexedElement } from './indexedElements';

const text = (value: string) => variant('STRING', value);

/** One value of each builtin type, by its Godot name, with an element at index 0 where the type has one. */
const ONE_ELEMENT: Readonly<Record<string, string>> = {
  String: '"a"',
  Vector2: 'Vector2(1, 2)',
  Vector2i: 'Vector2i(1, 2)',
  Vector3: 'Vector3(1, 2, 3)',
  Vector3i: 'Vector3i(1, 2, 3)',
  Transform2D: 'Transform2D(1, 0, 0, 1, 0, 0)',
  Vector4: 'Vector4(1, 2, 3, 4)',
  Vector4i: 'Vector4i(1, 2, 3, 4)',
  Quaternion: 'Quaternion(0, 0, 0, 1)',
  Basis: 'Basis(1, 0, 0, 0, 1, 0, 0, 0, 1)',
  Projection: 'Projection(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)',
  Color: 'Color(1, 0, 0, 1)',
  Array: '[1]',
  PackedByteArray: 'PackedByteArray(1)',
  PackedInt32Array: 'PackedInt32Array(1)',
  PackedInt64Array: 'PackedInt64Array(1)',
  PackedFloat32Array: 'PackedFloat32Array(1)',
  PackedFloat64Array: 'PackedFloat64Array(1)',
  PackedStringArray: 'PackedStringArray("a")',
  PackedVector2Array: 'PackedVector2Array(1, 2)',
  PackedVector3Array: 'PackedVector3Array(1, 2, 3)',
  PackedColorArray: 'PackedColorArray(1, 0, 0, 1)',
  PackedVector4Array: 'PackedVector4Array(1, 2, 3, 4)',
  int: '1',
  float: '1.0',
  bool: 'true',
  Rect2: 'Rect2(1, 2, 3, 4)',
  AABB: 'AABB(1, 2, 3, 4, 5, 6)',
  Plane: 'Plane(1, 0, 0, 1)',
  Transform3D: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
  NodePath: 'NodePath("a")',
  StringName: '&"a"',
};

describe('indexedElement', () => {
  it('reads a character of a String', () => {
    expect(indexedElement(text('abc'), 1n)).toEqual(text('b'));
  });

  it('gives nothing for an index past the end', () => {
    expect(indexedElement(text('abc'), 3n)).toBeUndefined();
  });

  it('counts a negative index from the end of a sequence', () => {
    expect(indexedElement(text('abc'), -3n)).toEqual(text('a'));
  });

  it('refuses a negative index on a type with a fixed size', () => {
    expect(indexedElement(variant('VECTOR2', { x: 1, y: 2 }), -1n)).toBeUndefined();
  });

  it('holds a sample of every type Godot 4.6.3 lists with an integer index, a Dictionary aside', () => {
    const indexed = Object.entries(BUILTIN_TYPES).filter(([, row]) => row.indexing !== '' && !row.isKeyed);
    expect(indexed.map(([name]) => name).filter((name) => !(name in ONE_ELEMENT))).toEqual([]);
  });

  it.each(Object.keys(ONE_ELEMENT))('reads index 0 of %s only where Godot 4.6.3 lists an index', (name) => {
    const hasIndex = BUILTIN_TYPES[name]!.indexing !== '';
    expect(indexedElement(textToVariant(ONE_ELEMENT[name]!), 0n) !== undefined).toBe(hasIndex);
  });
});
