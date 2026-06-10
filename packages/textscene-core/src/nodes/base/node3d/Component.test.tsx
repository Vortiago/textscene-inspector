import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Node3D } from './Component';
import type { TscnNode } from '../../../parser/types';
import type { Node3DProperties, Transform3D } from './types';

function makeNode(properties: Node3DProperties): TscnNode {
  return {
    name: properties.name ?? 'TestNode3D',
    type: 'Node3D',
    children: [],
    properties,
  };
}

const identityTransform: Transform3D = {
  basis_x: { x: 1, y: 0, z: 0 },
  basis_y: { x: 0, y: 1, z: 0 },
  basis_z: { x: 0, y: 0, z: 1 },
  origin: { x: 2, y: 3, z: 4 },
};

describe('<Node3D>', () => {
  it('renders a named group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Node3D node={makeNode({ name: 'MyNode' })} />
    );
    expect(renderer.scene.findByProps({ name: 'MyNode' })).toBeDefined();
  });

  it('applies origin translation to position', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Node3D node={makeNode({ name: 'Translated', transform: identityTransform })} />
    );
    const group = renderer.scene.findByProps({ name: 'Translated' });
    expect(group.instance.position.x).toBe(2);
    expect(group.instance.position.y).toBe(3);
    expect(group.instance.position.z).toBe(4);
  });

  it('defaults to identity when no transform provided', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Node3D node={makeNode({ name: 'NoTransform' })} />
    );
    const group = renderer.scene.findByProps({ name: 'NoTransform' });
    expect(group.instance.position.x).toBe(0);
    expect(group.instance.scale.x).toBe(1);
  });

  it('renders children inside the transform group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Node3D node={makeNode({ name: 'Parent' })}>
        <mesh name="kid">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </Node3D>
    );
    expect(renderer.scene.findByProps({ name: 'kid' })).toBeDefined();
  });
});
