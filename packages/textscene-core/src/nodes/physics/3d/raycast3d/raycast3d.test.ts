/**
 * RayCast3D registration: it is parsed, and it draws its editor ray gizmo
 * (ray_cast_3d_gizmo_plugin.cpp:61-69).
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseRayCast3D } from './parser';
import { RayCast3D } from './Component';
import './index';
import './index.r3f';

describe('RayCast3D registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('RayCast3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseRayCast3D);
  });

  it('registers its own component, which keeps children in the Node3D transform space', () => {
    expect(nodeComponentRegistry.get('RayCast3D')).toBe(RayCast3D);
  });

  it('registers as a drawing type, not a gap', () => {
    expect(nodeComponentRegistry.renderIntentOf('RayCast3D')).toBe('draws');
  });
});
