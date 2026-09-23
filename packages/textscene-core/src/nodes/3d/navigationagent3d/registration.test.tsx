/**
 * NavigationAgent3D render contract: it reuses the base Node group, registered
 * `container: true` so the non-spatial helper passes through both the 2D and 3D
 * workspaces.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import './index.r3f';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';
import { parseNavigationAgent3D } from './parser';
import type { TscnNode } from '../../../parser/types';

const agentNode: TscnNode = {
  name: 'Movement',
  type: 'NavigationAgent3D',
  children: [],
  properties: parseNavigationAgent3D(
    { type: 'node', attributes: { type: 'NavigationAgent3D', name: 'Movement' } },
    {}
  ),
};

describe('NavigationAgent3D render contract', () => {
  it('reuses the base Node group, registered as a container', () => {
    expect(nodeComponentRegistry.get('NavigationAgent3D')).toBe(Node);
    expect(nodeComponentRegistry.isContainer('NavigationAgent3D')).toBe(true);
    expect(nodeComponentRegistry.isCanvasItem('NavigationAgent3D')).toBe(false);
  });

  it('renders an invisible group positioning children (no own geometry)', async () => {
    const Component = nodeComponentRegistry.get('NavigationAgent3D')!;
    const renderer = await ReactThreeTestRenderer.create(
      <Component node={agentNode}>
        <mesh name="child" />
      </Component>
    );
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });
});
