/**
 * GeometryInstance3D registration — it is parsed, and it draws nothing on purpose
 * (ADR-0008) rather than for want of an implementation.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { parseNode3D } from '../../base/node3d/parser';
import { Node3D } from '../../base/node3d/Component';
import './index';
import './index.r3f';

describe('GeometryInstance3D registration', () => {
  it('registers the Node3D base parser', () => {
    const registration = nodeRegistry.getRegistration('GeometryInstance3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode3D);
  });

  it('reuses the Node3D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('GeometryInstance3D')).toBe(Node3D);
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.isTransformOnly('GeometryInstance3D')).toBe(true);
  });
});
