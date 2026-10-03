/**
 * PhysicalBoneSimulator3D registration: it is parsed, and its driving of the parent Skeleton3D's
 * bone poses from physics bodies is a gap (ADR-0045), not a nil effect. It registers `pending` on
 * the Node3D component, so children keep their transform space while the badge reads a gap.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseNode3D } from '../../../base/node3d/parser';
import { Node3D } from '../../../base/node3d/Component';
import './index';
import './index.r3f';

describe('PhysicalBoneSimulator3D registration', () => {
  it('registers the parseNode3D parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('PhysicalBoneSimulator3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode3D);
  });

  it('reuses the Node3D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('PhysicalBoneSimulator3D')).toBe(Node3D);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.renderIntentOf('PhysicalBoneSimulator3D')).toBe('pending');
  });
});
