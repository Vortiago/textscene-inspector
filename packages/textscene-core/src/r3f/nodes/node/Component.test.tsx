import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Node } from './Component';
import type { TscnNode } from '../../../parser/types';

const baseNode: TscnNode = {
  name: 'Root',
  type: 'Node',
  children: [],
  properties: {},
};

describe('<Node>', () => {
  it('renders a group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Node node={baseNode} />);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('renders children inside the group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Node node={baseNode}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </Node>
    );
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });

  it('does not apply any transform', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Node node={baseNode} />);
    const group = renderer.scene.findByType('Group');
    expect(group.instance.position.x).toBe(0);
    expect(group.instance.position.y).toBe(0);
    expect(group.instance.position.z).toBe(0);
  });
});
