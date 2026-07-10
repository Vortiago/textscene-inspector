import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { parseNavigationObstacle3D } from './parser';
import { NavigationObstacle3D } from './Component';

const baseNode: TscnNode = {
  name: 'MyNavigationObstacle3D',
  type: 'NavigationObstacle3D',
  children: [],
  properties: parseNavigationObstacle3D(
    { type: 'node', attributes: { type: 'NavigationObstacle3D', name: 'MyNavigationObstacle3D' } },
    {}
  ),
};

describe('<NavigationObstacle3D>', () => {
  it('renders a group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<NavigationObstacle3D node={baseNode} />);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('renders children inside the group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <NavigationObstacle3D node={baseNode}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </NavigationObstacle3D>
    );
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });
});
