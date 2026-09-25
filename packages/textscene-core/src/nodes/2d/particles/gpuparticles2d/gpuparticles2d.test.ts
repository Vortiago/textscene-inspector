/**
 * GPUParticles2D is parsed and validated, not yet rendered. Its base component
 * registers under `renderIntent: 'pending'`, so the badge reads a gap.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../../r3f/nodeSupport';
import { parseNode2D } from '../../../base/node2d/parser';
import './index';
import './index.r3f';

describe('GPUParticles2D registration', () => {
  it('registers the Node2D base parser', () => {
    const registration = nodeRegistry.getRegistration('GPUParticles2D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode2D);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.renderIntentOf('GPUParticles2D')).toBe('pending');
    expect(rendersOwnVisual('GPUParticles2D')).toBe('not-implemented');
  });
});
