/**
 * GPUParticlesCollisionSphere3D registration: parsed and validated, not rendered. The slice
 * registers a base component under `renderIntent: 'pending'`, so the badge
 * reads a gap while `visible` and the workspace split still behave.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../../../r3f/nodeSupport';
import './index';
import './index.r3f';
import { parseGPUParticlesCollisionSphere3D } from './parser';

describe('GPUParticlesCollisionSphere3D registration', () => {
  it('registers the parser that reads the shape of the gizmo', () => {
    const registration = nodeRegistry.getRegistration('GPUParticlesCollisionSphere3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseGPUParticlesCollisionSphere3D);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.renderIntentOf('GPUParticlesCollisionSphere3D')).toBe('pending');
    expect(rendersOwnVisual('GPUParticlesCollisionSphere3D')).toBe('not-implemented');
  });
});
