/**
 * ShapeCast3D registration: it is parsed, and it draws its editor swept-shape gizmo
 * (shape_cast_3d_gizmo_plugin.cpp:61-69).
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseShapeCast3D } from './parser';
import { ShapeCast3D } from './Component';
import './index';
import './index.r3f';

describe('ShapeCast3D registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('ShapeCast3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseShapeCast3D);
  });

  it('registers its own component, which keeps children in the Node3D transform space', () => {
    expect(nodeComponentRegistry.get('ShapeCast3D')).toBe(ShapeCast3D);
  });

  it('registers as a drawing type, not a gap', () => {
    expect(nodeComponentRegistry.renderIntentOf('ShapeCast3D')).toBe('draws');
  });
});
