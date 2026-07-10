/**
 * RemoteTransform2D render contract: no component of its own — the registry
 * reuses the Node2D transform group (ADR-0008), registered as a CanvasItem
 * so it stays in the 2D world canvas.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import './index.r3f';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';
import { parseRemoteTransform2D } from './parser';
import type { TscnNode } from '../../../parser/types';

function remoteTransformNode(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'Follower',
    type: 'RemoteTransform2D',
    children: [],
    properties: parseRemoteTransform2D(
      { type: 'node', attributes: { type: 'RemoteTransform2D', name: 'Follower' } },
      raw
    ),
  };
}

describe('RemoteTransform2D render contract', () => {
  it('reuses the Node2D transform group, registered as a CanvasItem', () => {
    expect(nodeComponentRegistry.get('RemoteTransform2D')).toBe(Node2D);
    expect(nodeComponentRegistry.isCanvasItem('RemoteTransform2D')).toBe(true);
    expect(nodeComponentRegistry.isContainer('RemoteTransform2D')).toBe(false);
  });

  it('renders an invisible group positioning children (no own geometry)', async () => {
    const Component = nodeComponentRegistry.get('RemoteTransform2D')!;
    const renderer = await ReactThreeTestRenderer.create(
      <Component node={remoteTransformNode({ position: 'Vector2(10, 20)' })}>
        <mesh name="child" />
      </Component>
    );
    const group = renderer.scene.children[0]!.instance as THREE.Group;
    expect(group.position.x).toBeCloseTo(10, 5);
    expect(group.position.y).toBeCloseTo(-20, 5);
    expect(group.children.some((c) => c.name === 'child')).toBe(true);
  });
});
