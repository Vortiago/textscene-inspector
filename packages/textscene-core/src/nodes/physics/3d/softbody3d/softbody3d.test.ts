/**
 * SoftBody3D registration: parsed and validated, not yet rendered. The Node3D
 * base under `renderIntent: 'pending'` makes `rendersOwnVisual` report
 * 'not-implemented', while `visible` and the 3D-only workspace placement still
 * work. An absent registration keeps neither.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../../r3f/nodeSupport';
import { drawsInWorkspace } from '../../../../r3f/nodeWorkspaceVisibility';
import { parseMeshInstance3D } from '../../../3d/meshinstance3d/parser';
import './index';
import './index.r3f';

describe('SoftBody3D registration', () => {
  it('reuses MeshInstance3D\'s parser, the ancestor that reads its properties', () => {
    const registration = nodeRegistry.getRegistration('SoftBody3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseMeshInstance3D);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.renderIntentOf('SoftBody3D')).toBe('pending');
    expect(rendersOwnVisual('SoftBody3D')).toBe('not-implemented');
  });

  it('stays out of the 2D canvas, which an absent registration would not', () => {
    expect(drawsInWorkspace('SoftBody3D', '3d')).toBe(true);
    expect(drawsInWorkspace('SoftBody3D', '2d')).toBe(false);
  });
});
