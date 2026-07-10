import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { parseRemoteTransform3D } from './parser';
import { RemoteTransform3D } from './Component';

const baseNode: TscnNode = {
  name: 'MyRemoteTransform3D',
  type: 'RemoteTransform3D',
  children: [],
  properties: parseRemoteTransform3D(
    { type: 'node', attributes: { type: 'RemoteTransform3D', name: 'MyRemoteTransform3D' } },
    {}
  ),
};

describe('<RemoteTransform3D>', () => {
  it('renders a group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<RemoteTransform3D node={baseNode} />);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('renders children inside the group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <RemoteTransform3D node={baseNode}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </RemoteTransform3D>
    );
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });
});
