import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { GPU_PARTICLES_DEFAULT_VISIBILITY_AABB } from '../../../../godot/gpuParticles';
import type { TscnNode } from '../../../../parser/types';
import { parseGPUParticles3D } from './parser';
import { useGPUParticles3DAabb } from './ownAabb';

function emitter(properties: Record<string, string>): TscnNode {
  const parsed = parseGPUParticles3D(heading('GPUParticles3D', { name: 'Sparks' }), properties);
  return {
    name: 'Sparks',
    type: 'GPUParticles3D',
    rawProperties: properties,
    children: [],
    properties: parsed,
  };
}

describe('useGPUParticles3DAabb', () => {
  it('takes the authored visibility_aabb', () => {
    expect(useGPUParticles3DAabb(emitter({ visibility_aabb: 'AABB(0, 0, 0, 1, 2, 3)' })).size).toEqual({
      x: 1,
      y: 2,
      z: 3,
    });
  });

  it("takes the constructor's box for an emitter that authors none (error case)", () => {
    expect(useGPUParticles3DAabb(emitter({}))).toBe(GPU_PARTICLES_DEFAULT_VISIBILITY_AABB);
  });

  it('keeps an authored empty box, which the scene cull does not index (edge case)', () => {
    expect(useGPUParticles3DAabb(emitter({ visibility_aabb: 'AABB(0, 0, 0, 0, 0, 0)' })).size).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
  });
});
