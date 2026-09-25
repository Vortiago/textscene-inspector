/**
 * Timer render contract: no component of its own. The registry reuses the
 * base Node group, registered `container: true` so the non-spatial helper
 * passes through both the 2D and 3D workspaces.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import './index.r3f';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';
import { parseTimer } from './parser';
import type { TscnNode } from '../../../parser/types';

const timerNode: TscnNode = {
  name: 'MyTimer',
  type: 'Timer',
  children: [],
  properties: parseTimer({ type: 'node', attributes: { type: 'Timer', name: 'MyTimer' } }, {}),
};

describe('Timer render contract', () => {
  it('reuses the base Node group, registered as a container', () => {
    expect(nodeComponentRegistry.get('Timer')).toBe(Node);
    expect(nodeComponentRegistry.isContainer('Timer')).toBe(true);
    expect(nodeComponentRegistry.isCanvasItem('Timer')).toBe(false);
  });

  it('renders an invisible group positioning children (no own geometry)', async () => {
    const Component = nodeComponentRegistry.get('Timer')!;
    const renderer = await ReactThreeTestRenderer.create(
      <Component node={timerNode}>
        <mesh name="child" />
      </Component>
    );
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });
});
