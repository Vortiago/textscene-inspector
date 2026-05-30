/**
 * Transform-only bodies (ADR-0005): StaticBody3D and Area3D render via the
 * Node3D transform group; the non-spatial AudioStreamPlayer renders via the
 * base Node (zero geometry). This guards the user-facing guarantee that these
 * types render as their intended group, NOT the gray GenericNodeFallback cube.
 */

import { describe, expect, it } from 'vitest';
import '../../../r3f/nodes/index'; // trigger all render-component registrations
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';
import { Node } from '../../node/Component';

describe('transform-only bodies render without a fallback placeholder', () => {
  it('StaticBody3D reuses the Node3D transform group', () => {
    expect(nodeComponentRegistry.get('StaticBody3D')).toBe(Node3D);
  });

  it('Area3D reuses the Node3D transform group', () => {
    expect(nodeComponentRegistry.get('Area3D')).toBe(Node3D);
  });

  it('AudioStreamPlayer reuses the base Node (zero geometry)', () => {
    expect(nodeComponentRegistry.get('AudioStreamPlayer')).toBe(Node);
  });
});
