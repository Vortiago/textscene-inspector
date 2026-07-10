import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { parseRemoteTransform2D } from './parser';
import { RemoteTransform2D } from './Component';

const baseNode: TscnNode = {
  name: 'MyRemoteTransform2D',
  type: 'RemoteTransform2D',
  children: [],
  properties: parseRemoteTransform2D(
    { type: 'node', attributes: { type: 'RemoteTransform2D', name: 'MyRemoteTransform2D' } },
    {}
  ),
};

describe('<RemoteTransform2D>', () => {
  it('renders a group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<RemoteTransform2D node={baseNode} />);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('renders children inside the group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <RemoteTransform2D node={baseNode}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </RemoteTransform2D>
    );
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });
});
