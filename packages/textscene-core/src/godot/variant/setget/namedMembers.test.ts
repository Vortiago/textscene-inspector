import { describe, expect, it } from 'vitest';
import { BUILTIN_TYPES } from '../call/builtinTypes.generated';
import { textToVariant } from '../reader/variantReader';
import { variant } from '../value/variant';
import { memberOf } from './namedMembers';

const vector2 = variant('VECTOR2', { x: 1, y: 2 });

/** One value of each builtin type that has named members, by its Godot name. */
const SAMPLES: Readonly<Record<string, string>> = {
  Vector2: 'Vector2(1, 2)',
  Vector2i: 'Vector2i(1, 2)',
  Rect2: 'Rect2(1, 2, 3, 4)',
  Rect2i: 'Rect2i(1, 2, 3, 4)',
  Vector3: 'Vector3(1, 2, 3)',
  Vector3i: 'Vector3i(1, 2, 3)',
  Transform2D: 'Transform2D(1, 0, 0, 1, 0, 0)',
  Vector4: 'Vector4(1, 2, 3, 4)',
  Vector4i: 'Vector4i(1, 2, 3, 4)',
  Plane: 'Plane(1, 0, 0, 1)',
  Quaternion: 'Quaternion(0, 0, 0, 1)',
  AABB: 'AABB(1, 2, 3, 4, 5, 6)',
  Basis: 'Basis(1, 0, 0, 0, 1, 0, 0, 0, 1)',
  Transform3D: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)',
  Projection: 'Projection(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)',
  Color: 'Color(1, 0.5, 0, 1)',
};

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

  it('holds a sample of every type that Godot 4.6.3 lists with members', () => {
    const withMembers = Object.entries(BUILTIN_TYPES).filter(([, row]) => row.members.length > 0);
    expect(withMembers.map(([name]) => name).filter((name) => !(name in SAMPLES))).toEqual([]);
  });

  it.each(Object.keys(SAMPLES))('reads each member that Godot 4.6.3 lists for %s', (name) => {
    const sample = textToVariant(SAMPLES[name]!);
    const unread = BUILTIN_TYPES[name]!.members.filter(([member]) => memberOf(sample, member) === undefined);
    expect(unread).toEqual([]);
  });
});
