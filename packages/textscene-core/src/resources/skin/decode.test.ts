/**
 * The Skin decode: `bind_count` and `bind/<i>/{bone,name,pose}`, each default and refusal
 * citing `scene/resources/3d/skin.cpp`.
 */

import { describe, expect, it } from 'vitest';
import { parseTresFile } from '../../parser/parsedResource';
import { identityTransform3D } from '../../godot/math/transform3d';
import { decodeSkin } from './decode';

/** A `.tres` Skin whose `[resource]` body is `body`. */
function decodeText(body: string) {
  const { properties } = parseTresFile(`[gd_resource type="Skin" format=3]\n\n[resource]\n${body}\n`);
  return decodeSkin(properties);
}

const SHIFTED_UP = 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0.5, 0)';

describe('decodeSkin', () => {
  it('reads the bone, the name and the pose of each bind', () => {
    const binds = decodeText(
      `bind_count = 2\nbind/0/name = &"hip"\nbind/0/bone = 3\nbind/0/pose = ${SHIFTED_UP}\nbind/1/bone = 1`
    );
    expect(binds).toHaveLength(2);
    expect(binds[0]).toMatchObject({ name: 'hip', bone: 3 });
    expect(binds[0]!.pose.origin).toEqual({ x: 0, y: 0.5, z: 0 });
    expect(binds[1]).toMatchObject({ name: '', bone: 1 });
  });

  it('gives a bind with no keys no bone, no name and the identity pose (skin.h:38-42)', () => {
    expect(decodeText('bind_count = 1')).toEqual([{ bone: -1, name: '', pose: identityTransform3D() }]);
  });

  it('has no binds without bind_count', () => {
    expect(decodeText('bind/0/bone = 2')).toEqual([]);
  });

  it('drops a key for an index at or past bind_count, as set_bind_* fails its index check (skin.cpp:56)', () => {
    const binds = decodeText('bind_count = 1\nbind/1/bone = 2\nbind/5/name = &"late"');
    expect(binds).toEqual([{ bone: -1, name: '', pose: identityTransform3D() }]);
  });

  it('drops a key for a negative index', () => {
    expect(decodeText('bind_count = 1\nbind/-1/bone = 2')[0]!.bone).toBe(-1);
  });

  it('reads the index as to_int does: +1 is bind 1', () => {
    expect(decodeText('bind_count = 2\nbind/+1/bone = 4')[1]!.bone).toBe(4);
  });

  it('has no binds for a negative bind_count (skin.cpp:34)', () => {
    expect(decodeText('bind_count = -1\nbind/0/bone = 2')).toEqual([]);
  });

  it('ignores a tail below the leaf, as get_slicec does', () => {
    expect(decodeText('bind_count = 1\nbind/0/bone/extra = 2')[0]!.bone).toBe(2);
  });

  it('keeps the identity pose for a pose that is not a Transform3D', () => {
    expect(decodeText('bind_count = 1\nbind/0/pose = Vector3(1, 2, 3)')[0]!.pose).toEqual(
      identityTransform3D()
    );
  });
});
