/**
 * RemoteTransform3D render contract: no component of its own. The registry reuses the Node3D
 * transform group (ADR-0008) as a 3D-only type (neither `canvasItem` nor `container`).
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import './index.r3f';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { parseRemoteTransform3D } from './parser';
import type { TscnNode } from '../../../parser/types';

function remoteTransformNode(raw: Record<string, string> = {}): TscnNode {
  return {
    name: 'Follower',
    type: 'RemoteTransform3D',
    children: [],
    properties: parseRemoteTransform3D(
      { type: 'node', attributes: { type: 'RemoteTransform3D', name: 'Follower' } },
      raw
    ),
  };
}

describe('RemoteTransform3D render contract', () => {
  it('reuses the Node3D transform group, registered as a pure 3D type', () => {
    expect(nodeComponentRegistry.get('RemoteTransform3D')).toBe(Node3D);
    expect(nodeComponentRegistry.isCanvasItem('RemoteTransform3D')).toBe(false);
    expect(nodeComponentRegistry.isContainer('RemoteTransform3D')).toBe(false);
  });

  it('renders an invisible group positioning children (no own geometry)', async () => {
    const Component = nodeComponentRegistry.get('RemoteTransform3D')!;
    const renderer = await ReactThreeTestRenderer.create(
      <Component node={remoteTransformNode({ transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 2, 3, 4)' })}>
        <mesh name="child" />
      </Component>
    );
    const group = renderer.scene.children[0]!.instance as THREE.Group;
    expect(group.position.x).toBeCloseTo(2, 5);
    expect(group.children.some((c) => c.name === 'child')).toBe(true);
  });
});
