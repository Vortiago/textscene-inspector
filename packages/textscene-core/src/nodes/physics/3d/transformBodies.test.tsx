/**
 * Transform-only render intent (ADR-0005, ADR-0008): physics bodies and Skeleton3D
 * render as a Node3D group, and AudioStreamPlayer as the base Node, never as the
 * gray GenericNodeFallback placeholder. GPUParticles3D is unimplemented, so it has no
 * component, and GenericNodeFallback still applies the Node3D transform to its children.
 */

import { describe, expect, it } from 'vitest';
import '../../../r3f/nodes/index'; // trigger all render-component registrations
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { Node } from '../../node/Component';

describe('transform-only bodies render without a fallback placeholder', () => {
  it.each([
    'StaticBody3D',
    'Area3D',
    'RigidBody3D',
    'VehicleBody3D',
    'CharacterBody3D',
    'Skeleton3D',
  ])('%s reuses the Node3D transform group', (type) => {
    expect(nodeComponentRegistry.get(type)).toBe(Node3D);
  });

  it('AudioStreamPlayer reuses the base Node (zero geometry)', () => {
    expect(nodeComponentRegistry.get('AudioStreamPlayer')).toBe(Node);
  });
});
