import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { GPU_PARTICLES_DEFAULT_VISIBILITY_AABB } from '../../../../godot/gpuParticles';
import { parseGPUParticles3D } from './parser';

const parse = (properties: Record<string, string>) =>
  parseGPUParticles3D(heading('GPUParticles3D', { name: 'Sparks' }), properties);

describe('parseGPUParticles3D', () => {
  it('reads visibility_aabb as the emitter box', () => {
    expect(parse({ visibility_aabb: 'AABB(-1, -2, -3, 2, 4, 6)' }).visibilityAabb).toEqual({
      position: { x: -1, y: -2, z: -3 },
      size: { x: 2, y: 4, z: 6 },
    });
  });

  it("keeps the constructor's box for an emitter that authors none", () => {
    expect(parse({}).visibilityAabb).toBe(GPU_PARTICLES_DEFAULT_VISIBILITY_AABB);
  });

  it("keeps the constructor's box for a malformed visibility_aabb (error case)", () => {
    expect(parse({ visibility_aabb: 'AABB(bad)' }).visibilityAabb).toBe(
      GPU_PARTICLES_DEFAULT_VISIBILITY_AABB
    );
  });

  it('keeps an authored AABB() empty, as the particles hold it (edge case)', () => {
    expect(parse({ visibility_aabb: 'AABB(0, 0, 0, 0, 0, 0)' }).visibilityAabb.size).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
  });
});
