import { describe, expect, it } from 'vitest';
import { subResource } from '../../testing/subResource';
import { nodeReference } from '../reading/scopedReference';
import { staticSnapshot } from '../reading/staticSnapshot.testkit';
import { SKIN_BIND_POSES } from './bindPosesKind';

/** The heights of the bind poses of a resource of `type`, or null where the kind does not read it. */
function heights(type: string, data: Record<string, string>): number[] | null {
  const scene = { internalResources: [subResource(type, 'only', data)], externalResources: [] };
  const read = staticSnapshot({}).read(nodeReference('SubResource("only")', scene), SKIN_BIND_POSES);
  return read.value && read.value.map((pose) => pose.origin.y);
}

const POSE = (y: number) => `Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, ${y}, 0)`;

describe('SKIN_BIND_POSES', () => {
  it('gives the pose of every bind of a Skin, in order', () => {
    const skin = { bind_count: '2', 'bind/0/pose': POSE(1), 'bind/1/pose': POSE(-2) };
    expect(heights('Skin', skin)).toEqual([1, -2]);
  });

  it('gives a bind with no pose the identity (edge case)', () => {
    expect(heights('Skin', { bind_count: '1' })).toEqual([0]);
  });

  it('gives a Skin with no binds an empty list, which still wins over a draw pass (edge case)', () => {
    expect(heights('Skin', {})).toEqual([]);
  });

  it('reads no other resource type (error case)', () => {
    expect(heights('BoxMesh', {})).toBeNull();
  });
});
