import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { parseTimer } from './parser';
import { Timer } from './Component';

const baseNode: TscnNode = {
  name: 'MyTimer',
  type: 'Timer',
  children: [],
  properties: parseTimer(
    { type: 'node', attributes: { type: 'Timer', name: 'MyTimer' } },
    {}
  ),
};

describe('<Timer>', () => {
  it('renders a group', async () => {
    const renderer = await ReactThreeTestRenderer.create(<Timer node={baseNode} />);
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
  });

  it('renders children inside the group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Timer node={baseNode}>
        <mesh name="child">
          <boxGeometry />
          <meshBasicMaterial />
        </mesh>
      </Timer>
    );
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });
});
