/**
 * `Skeleton3D::_set` for `bones/<i>/<leaf>` (`skeleton_3d.cpp:80-135`): the writes of a file, in
 * order, build the bone table. Each key lands as the setter it names, or is dropped as Godot drops it.
 */

import { describe, expect, it } from 'vitest';
import { readBones } from './readBones';

/** `bones/<i>/name` keys for `names`, which add one bone each. */
function named(...names: string[]): Record<string, string> {
  return Object.fromEntries(names.map((name, i) => [`bones/${i}/name`, `"${name}"`]));
}

describe('readBones', () => {
  it('adds a bone for each name written at the next index, in the order the keys come', () => {
    const bones = readBones(named('hip', 'knee', 'foot'));

    expect(bones.map((bone) => bone.name)).toEqual(['hip', 'knee', 'foot']);
  });

  it("gives a bone with only a name Godot's defaults: no parent, enabled, the identity pose", () => {
    const [bone] = readBones(named('hip'));

    expect(bone).toMatchObject({
      parent: -1,
      enabled: true,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0, w: 1 },
      scale: { x: 1, y: 1, z: 1 },
    });
    expect(bone!.rest.basis_x).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('reads parent, enabled, position, rotation, scale and rest into the bone they name', () => {
    const bones = readBones({
      ...named('hip', 'knee'),
      'bones/1/parent': '0',
      'bones/1/rest': 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.2, 0)',
      'bones/1/enabled': 'false',
      'bones/1/position': 'Vector3(0, -0.2, 0)',
      'bones/1/rotation': 'Quaternion(0, 0, 0.5, 0.866025)',
      'bones/1/scale': 'Vector3(1, 2, 3)',
    });

    expect(bones[1]).toMatchObject({
      parent: 0,
      enabled: false,
      // A Vector3 field holds single precision.
      position: { x: 0, y: Math.fround(-0.2), z: 0 },
      rotation: { x: 0, y: 0, z: 0.5, w: 0.866025 },
      scale: { x: 1, y: 2, z: 3 },
    });
    expect(bones[1]!.rest.origin).toEqual({ x: 0, y: -0.2, z: 0 });
    expect(bones[0]!.parent).toBe(-1);
  });

  it('applies a later write over an earlier one (edge case)', () => {
    // `bones/00/…` names bone 0 again.
    const bones = readBones({
      ...named('hip'),
      'bones/0/position': 'Vector3(1, 0, 0)',
      'bones/00/position': 'Vector3(2, 0, 0)',
    });

    expect(bones[0]!.position.x).toBe(2);
  });

  it('drops a name written for a slot that is not the next one (`:85`)', () => {
    const bones = readBones({
      'bones/1/name': '"late"',
      'bones/0/name': '"hip"',
      'bones/0/name/x': '"again"',
    });

    expect(bones.map((bone) => bone.name)).toEqual(['hip']);
  });

  it('drops a write to a bone that has not been added (`:90`)', () => {
    const bones = readBones({ 'bones/0/position': 'Vector3(1, 0, 0)', ...named('hip') });

    expect(bones[0]!.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('adds no bone for a name add_bone refuses, so the slot stays free for the next name (`:605`)', () => {
    const bones = readBones({
      'bones/0/name': '""',
      'bones/1/name': '"a:b"',
      'bones/2/name': '"a/b"',
      'bones/0/position': 'Vector3(5, 0, 0)',
    });

    expect(bones).toEqual([]);
  });

  it('adds no bone for a name another bone holds (`:606`)', () => {
    const bones = readBones({ 'bones/0/name': '"hip"', 'bones/1/name': '"hip"' });

    expect(bones.map((bone) => bone.name)).toEqual(['hip']);
  });

  it('reads the index as Godot does, so `bones/00/name` and `bones/+1/name` name slots 0 and 1', () => {
    const bones = readBones({ 'bones/00/name': '"a"', 'bones/+1/name': '"b"' });

    expect(bones.map((bone) => bone.name)).toEqual(['a', 'b']);
  });

  it('keeps a parent past the last bone, which the pose model reads as none', () => {
    const bones = readBones({ ...named('hip'), 'bones/0/parent': '9' });

    expect(bones[0]!.parent).toBe(9);
  });

  it('refuses a parent below -1, and a bone as its own parent, and keeps the parent it had (`:721-722`)', () => {
    const bones = readBones({
      ...named('hip', 'knee'),
      'bones/1/parent': '0',
      'bones/01/parent': '-2',
      'bones/0/parent': '0',
      'bones/00/parent': '0',
    });

    expect(bones.map((bone) => bone.parent)).toEqual([-1, 0]);
    expect(readBones({ ...named('a', 'b'), 'bones/1/parent': '0', 'bones/01/parent': '1' })[1]!.parent).toBe(
      0
    );
  });

  it('keeps the previous value for one that is malformed (edge case)', () => {
    const bones = readBones({
      ...named('hip'),
      'bones/0/position': 'Vector3(1, 0, 0)',
      'bones/00/position': 'nope',
      'bones/0/scale': 'Vector3(a, b, c)',
      'bones/0/rotation': 'Quaternion(1, 2)',
      'bones/0/rest': 'Transform3D(1)',
      'bones/0/enabled': 'maybe',
    });

    expect(bones[0]).toMatchObject({ enabled: true, scale: { x: 1, y: 1, z: 1 } });
    expect(bones[0]!.position.x).toBe(1);
  });

  it('ignores the 3.x pose and bound_children, which carry no 4.x bone state here', () => {
    const bones = readBones({
      ...named('hip'),
      'bones/0/pose': 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 7, 7, 7)',
      'bones/0/bound_children': '[]',
      'bones/0/bone_meta/key': '1',
    });

    expect(bones[0]!.position).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('reads a skeleton with no bones key as an empty table', () => {
    expect(readBones({})).toEqual([]);
    expect(readBones({ motion_scale: '2' })).toEqual([]);
  });
});
