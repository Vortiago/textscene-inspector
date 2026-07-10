import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { parseNavigationAgent3D } from './parser';
import { NavigationAgent3D } from './Component';

const baseNode: TscnNode = {
  name: 'MyNavigationAgent3D',
  type: 'NavigationAgent3D',
  children: [],
  properties: parseNavigationAgent3D(
    { type: 'node', attributes: { type: 'NavigationAgent3D', name: 'MyNavigationAgent3D' } },
    {}
  ),
};

describe('<NavigationAgent3D>', () => {
  it('renders a group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<NavigationAgent3D node={baseNode} />);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('renders children inside the group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <NavigationAgent3D node={baseNode}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </NavigationAgent3D>
    );
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });
});
