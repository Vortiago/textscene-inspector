/**
 * GPUParticlesCollisionBox3D registration: parsed and validated, not rendered. The slice
 * registers a base component under `renderIntent: 'pending'`, so the badge
 * reads a gap while `visible` and the workspace split still behave.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../../../r3f/nodeSupport';
import './index';
import './index.r3f';
import { parseBoxVolume } from '../../volume/parseBoxVolume';

describe('GPUParticlesCollisionBox3D registration', () => {
  it('registers the parser that reads the shape of the gizmo', () => {
    const registration = nodeRegistry.getRegistration('GPUParticlesCollisionBox3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseBoxVolume);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.renderIntentOf('GPUParticlesCollisionBox3D')).toBe('pending');
    expect(rendersOwnVisual('GPUParticlesCollisionBox3D')).toBe('not-implemented');
  });
});
