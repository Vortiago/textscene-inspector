/**
 * SpringArm3D registration: it is parsed, and it draws nothing by design
 * (ADR-0008), not for want of an implementation.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseNode3D } from '../../../base/node3d/parser';
import { Node3D } from '../../../base/node3d/Component';
import './index';
import './index.r3f';

describe('SpringArm3D registration', () => {
  it('registers the Node3D base parser', () => {
    const registration = nodeRegistry.getRegistration('SpringArm3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode3D);
  });

  it('reuses the Node3D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('SpringArm3D')).toBe(Node3D);
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.isTransformOnly('SpringArm3D')).toBe(true);
  });
});
