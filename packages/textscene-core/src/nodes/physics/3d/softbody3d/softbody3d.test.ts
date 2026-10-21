/**
 * SoftBody3D registration: it parses with MeshInstance3D's parser and draws with MeshInstance3D's
 * component, since it derives from MeshInstance3D (`soft_body_3d.h:66`). The previewer runs no
 * physics (ADR-0005), so the body stays at rest.
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
  it("reuses MeshInstance3D's parser, the ancestor that reads its properties", () => {
    const registration = nodeRegistry.getRegistration('SoftBody3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseMeshInstance3D);
  });

  it('reports that it draws, which a declared gap would not', () => {
    expect(nodeComponentRegistry.renderIntentOf('SoftBody3D')).not.toBe('pending');
    expect(rendersOwnVisual('SoftBody3D')).toBe('draws');
  });

  it('stays out of the 2D canvas, which an absent registration would not', () => {
    expect(drawsInWorkspace('SoftBody3D', '3d')).toBe(true);
    expect(drawsInWorkspace('SoftBody3D', '2d')).toBe(false);
  });
});
