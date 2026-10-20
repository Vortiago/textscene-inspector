/**
 * SpringArm3D registration: it is parsed, and its placement of its children is
 * a gap (ADR-0045), not a nil effect.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseSpringArm3D } from './parser';
import { SpringArm3D } from './Component';
import './index';
import './index.r3f';

describe('SpringArm3D registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('SpringArm3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseSpringArm3D);
  });

  it('registers its own component, which keeps children in the Node3D transform space', () => {
    expect(nodeComponentRegistry.get('SpringArm3D')).toBe(SpringArm3D);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.renderIntentOf('SpringArm3D')).toBe('pending');
  });
});
