import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { GenericNodeFallback } from './Component';
import type { TscnNode } from '../../../parser/types';

const baseNode: TscnNode = {
  name: 'MysteryNode',
  type: 'SomeUnrecognisedType',
  children: [],
  properties: {},
};

describe('<GenericNodeFallback>', () => {
  it('renders NO placeholder mesh — an invisible transform-only group (ADR-0008)', async () => {
    const renderer = await ReactThreeTestRenderer.create(<GenericNodeFallback node={baseNode} />);
    expect(renderer.scene.findAllByType('Mesh').length).toBe(0);
    expect(renderer.scene.findByProps({ name: 'MysteryNode' })).toBeDefined();
  });

  it('marks the group with placeholder metadata', async () => {
    const renderer = await ReactThreeTestRenderer.create(<GenericNodeFallback node={baseNode} />);
    const group = renderer.scene.findByProps({ name: 'MysteryNode' });
    const userData = group.instance.userData as { isPlaceholder: boolean; nodeType: string; nodeName: string };
    expect(userData.isPlaceholder).toBe(true);
    expect(userData.nodeType).toBe('SomeUnrecognisedType');
    expect(userData.nodeName).toBe('MysteryNode');
  });

  it('renders children through the fallback group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GenericNodeFallback node={baseNode}>
        <mesh name="passthrough">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </GenericNodeFallback>
    );
    expect(renderer.scene.findByProps({ name: 'passthrough' })).toBeDefined();
  });

  it('renders no box for a 2D-typed node (keeps 2D scenes flat)', async () => {
    const node2d: TscnNode = { name: 'Trail', type: 'GPUParticles2D', children: [], properties: {} };
    const renderer = await ReactThreeTestRenderer.create(<GenericNodeFallback node={node2d} />);
    expect(renderer.scene.findAllByType('Mesh').length).toBe(0);
  });

  it('still passes children through for a 2D-typed node', async () => {
    const node2d: TscnNode = { name: 'Particles', type: 'CPUParticles2D', children: [], properties: {} };
    const renderer = await ReactThreeTestRenderer.create(
      <GenericNodeFallback node={node2d}>
        <mesh name="child2d">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </GenericNodeFallback>
    );
    expect(renderer.scene.findByProps({ name: 'child2d' })).toBeDefined();
  });

  it('applies Node3D-style transform when present on properties', async () => {
    const node: TscnNode = {
      name: 'PositionedMystery',
      type: 'Foo',
      children: [],
      properties: {
        transform: {
          basis_x: { x: 1, y: 0, z: 0 },
          basis_y: { x: 0, y: 1, z: 0 },
          basis_z: { x: 0, y: 0, z: 1 },
          origin: { x: 7, y: 0, z: 0 },
        },
      },
    };
    const renderer = await ReactThreeTestRenderer.create(<GenericNodeFallback node={node} />);
    const group = renderer.scene.findByProps({ name: 'PositionedMystery' });
    expect(group.instance.position.x).toBe(7);
  });
});
