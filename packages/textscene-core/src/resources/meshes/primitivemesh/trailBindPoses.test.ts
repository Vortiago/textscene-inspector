import { describe, expect, it } from 'vitest';
import { subResource } from '../../../testing/subResource';
import { nodeReference } from '../../reading/scopedReference';
import { staticSnapshot } from '../../reading/staticSnapshot.testkit';
import { TRAIL_MESH_BIND_POSES } from './trailBindPoses';

/** The heights of the bind poses a mesh of `type` gives, or null for none. */
function heights(type: string, data: Record<string, string>): number[] | null {
  const scene = { internalResources: [subResource(type, 'only', data)], externalResources: [] };
  const read = staticSnapshot({}).read(nodeReference('SubResource("only")', scene), TRAIL_MESH_BIND_POSES);
  return read.value && read.value.map((pose) => pose.origin.y);
}

describe('TRAIL_MESH_BIND_POSES', () => {
  it.each(['RibbonTrailMesh', 'TubeTrailMesh'])(
    'gives %s sections + 1 translations along Y, negated, as the bind is an inverse transform',
    (type) => {
      const poses = heights(type, {})!;
      expect(poses).toHaveLength(6);
      [-0.5, -0.3, -0.1, 0.1, 0.3, 0.5].forEach((expected, index) =>
        expect(poses[index]).toBeCloseTo(expected, 6)
      );
    }
  );

  it('follows sections and section_length', () => {
    const poses = heights('RibbonTrailMesh', { sections: '2', section_length: '1' })!;
    [-1, 0, 1].forEach((expected, index) => expect(poses[index]).toBeCloseTo(expected, 6));
  });

  it('gives a mesh with no built-in poses none (edge case)', () => {
    expect(heights('BoxMesh', {})).toBeNull();
  });
});
