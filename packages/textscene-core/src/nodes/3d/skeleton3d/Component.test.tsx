import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Node3D } from '../../base/node3d/Component';
import type { Node3DProperties, Transform3D } from '../../base/node3d/types';
import type { TscnNode } from '../../../parser/types';

function makeNode(properties: Node3DProperties): TscnNode {
  return { name: properties.name ?? 'Skeleton3D', type: 'Skeleton3D', children: [], properties };
}

function skeletonNode(): TscnNode {
  return makeNode({ name: 'MySkeleton' });
}

describe('<Node3D> (skeleton3d component)', () => {
  it('renders a named group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Node3D node={skeletonNode()} />);
    expect(renderer.scene.findByProps({ name: 'MySkeleton' })).toBeDefined();
  });

  it('applies transform origin to position', async () => {
    const idTransform: Transform3D = {
      basis_x: { x: 1, y: 0, z: 0 },
      basis_y: { x: 0, y: 1, z: 0 },
      basis_z: { x: 0, y: 0, z: 1 },
      origin: { x: 2, y: 3, z: 4 },
    };
    const renderer = await ReactThreeTestRenderer.create(
      <Node3D node={makeNode({ name: 'Transformed', transform: idTransform })} />
    );
    const group = renderer.scene.findByProps({ name: 'Transformed' });
    expect(group.instance.position.x).toBe(2);
    expect(group.instance.position.y).toBe(3);
    expect(group.instance.position.z).toBe(4);
  });
});
