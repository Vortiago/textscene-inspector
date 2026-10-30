/** CPUParticles3D registration: parsed, validated and drawn. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../../r3f/nodeSupport';
import { parseCPUParticles3D } from './parser';
import './index';
import './index.r3f';

describe('CPUParticles3D registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('CPUParticles3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseCPUParticles3D);
  });

  it('registers a component that draws the particles', () => {
    expect(nodeComponentRegistry.renderIntentOf('CPUParticles3D')).toBe('draws');
    expect(rendersOwnVisual('CPUParticles3D')).toBe('draws');
  });
});
