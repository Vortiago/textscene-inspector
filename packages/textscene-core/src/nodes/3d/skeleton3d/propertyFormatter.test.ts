import { describe, expect, it } from 'vitest';
import { identityTransform3D } from '../../../godot/math/transform3d';
import { newBone } from './skeletonPose';
import { formatSkeleton3DProperties } from './propertyFormatter';

describe('formatSkeleton3DProperties', () => {
  it('lists the bone count and show_rest_only in a Skeleton3D section ahead of the Node3D ones', () => {
    const sections = formatSkeleton3DProperties({
      name: 'Skeleton3D',
      transform: { ...identityTransform3D(), origin: { x: 1, y: 2, z: 3 } },
      bones: [newBone('a'), newBone('b')],
      showRestOnly: true,
      motionScale: 1,
    });

    expect(sections[0]).toEqual({
      title: 'Skeleton3D',
      items: [
        { label: 'Bones', value: '2' },
        { label: 'Show Rest Only', value: 'true' },
      ],
    });
    expect(sections.length).toBeGreaterThan(1);
  });

  it('counts no bone for a skeleton that adds none (edge case)', () => {
    const [section] = formatSkeleton3DProperties({
      name: 'S',
      bones: [],
      showRestOnly: false,
      motionScale: 1,
    });

    expect(section!.items[0]).toEqual({ label: 'Bones', value: '0' });
  });
});
