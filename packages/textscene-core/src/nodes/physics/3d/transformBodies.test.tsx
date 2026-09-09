/**
 * Transform-only render intent (ADR-0005, ADR-0008): physics bodies and
 * Skeleton3D render via the Node3D transform group; the non-spatial
 * AudioStreamPlayer renders via the base Node (zero geometry). This guards the
 * guarantee that these types render as an invisible transform group, NOT the
 * retired gray GenericNodeFallback placeholder.
 *
 * GPUParticles3D LEFT this set (2026-07-30): Godot rasterises a particle cloud
 * at runtime, so it is unimplemented rather than invisible-by-design, and it
 * registers no component at all — the ADR-0008 amendment. Its children still
 * land correctly, because GenericNodeFallback applies the Node3D transform too.
 *
 * Marker3D / Path3D / PathFollow3D are NO LONGER in this set — ADR-0018 gave them
 * their own components (selection-gated gizmos + curve following); their identity
 * is pinned in their own slice tests.
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
