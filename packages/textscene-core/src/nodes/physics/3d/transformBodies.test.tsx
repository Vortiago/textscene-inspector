/**
 * Transform-only render intent (ADR-0005, ADR-0008): physics bodies, Skeleton3D,
 * Path3D / PathFollow3D and GPUParticles3D all render via the Node3D transform
 * group; the non-spatial AudioStreamPlayer renders via the base Node (zero
 * geometry). This guards the guarantee that these types render as an invisible
 * transform group, NOT the retired gray GenericNodeFallback placeholder.
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
    'CharacterBody3D',
    'Skeleton3D',
    'Path3D',
    'PathFollow3D',
    'GPUParticles3D',
  ])('%s reuses the Node3D transform group', (type) => {
    expect(nodeComponentRegistry.get(type)).toBe(Node3D);
  });

  it('AudioStreamPlayer reuses the base Node (zero geometry)', () => {
    expect(nodeComponentRegistry.get('AudioStreamPlayer')).toBe(Node);
  });
});
