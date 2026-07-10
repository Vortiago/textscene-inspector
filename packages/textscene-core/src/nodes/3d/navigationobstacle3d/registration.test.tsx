/**
 * NavigationObstacle3D render contract: no component of its own — the
 * registry reuses the Node3D transform group (ADR-0008), registered as a
 * pure 3D-only type (neither `canvasItem` nor `container`).
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import './index.r3f';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { parseNavigationObstacle3D } from './parser';
import type { TscnNode } from '../../../parser/types';

const obstacleNode: TscnNode = {
  name: 'Obstacle',
  type: 'NavigationObstacle3D',
  children: [],
  properties: parseNavigationObstacle3D(
    { type: 'node', attributes: { type: 'NavigationObstacle3D', name: 'Obstacle' } },
    {}
  ),
};

describe('NavigationObstacle3D render contract', () => {
  it('reuses the Node3D transform group, registered as a pure 3D type', () => {
    expect(nodeComponentRegistry.get('NavigationObstacle3D')).toBe(Node3D);
    expect(nodeComponentRegistry.isCanvasItem('NavigationObstacle3D')).toBe(false);
    expect(nodeComponentRegistry.isContainer('NavigationObstacle3D')).toBe(false);
  });

  it('renders an invisible group positioning children (no own geometry)', async () => {
    const Component = nodeComponentRegistry.get('NavigationObstacle3D')!;
    const renderer = await ReactThreeTestRenderer.create(
      <Component node={obstacleNode}>
        <mesh name="child" />
      </Component>
    );
    expect(renderer.scene.findAllByType('Group').length).toBeGreaterThan(0);
    expect(renderer.scene.findByProps({ name: 'child' })).toBeDefined();
  });
});
