/**
 * Marker3D registration smoke tests (transform-only slice, ADR-0008).
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { parseNode3D } from '../../base/node3d/parser';
import { Node3D } from '../../base/node3d/Component';
import './index';
import './index.r3f';

describe('Marker3D registration', () => {
  it('registers the Node3D base parser', () => {
    const registration = nodeRegistry.getRegistration('Marker3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode3D);
  });

  it('registers the Node3D render component (transform-only group)', () => {
    expect(nodeComponentRegistry.get('Marker3D')).toBe(Node3D);
  });
});
