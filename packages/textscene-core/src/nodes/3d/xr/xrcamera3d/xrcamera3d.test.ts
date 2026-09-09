/**
 * XRCamera3D registration. It IS a Camera3D — Godot's chain, and the parse this
 * slice already reuses — so both halves resolve to that ancestor rather than to
 * the coarse Node3D base.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../../r3f/nodeSupport';
import { parseCamera3D } from '../../camera3d/parser';
import { Camera3D } from '../../camera3d/Component';
import './index';
import './index.r3f';
import '../../camera3d/index.r3f';

describe('XRCamera3D registration', () => {
  it('registers the parseCamera3D parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('XRCamera3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseCamera3D);
  });

  it('draws the same frustum gizmo its Camera3D sibling does', () => {
    // The parse already yields Camera3DProperties, so taking Node3D here left
    // the two halves disagreeing: selecting a Camera3D drew a frustum and
    // selecting the XRCamera3D beside it drew nothing.
    expect(nodeComponentRegistry.get('XRCamera3D')).toBe(Camera3D);
  });

  it('claims no more and no less than Camera3D does', () => {
    expect(nodeComponentRegistry.isTransformOnly('XRCamera3D')).toBe(false);
    expect(rendersOwnVisual('XRCamera3D')).toBe(rendersOwnVisual('Camera3D'));
  });
});
