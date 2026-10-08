import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseParticles3D } from './parser';

describe('parseParticles3D', () => {
  it('reads visibility_aabb as the emitter box', () => {
    const result = parseParticles3D(heading('GPUParticles3D', { name: 'Sparks' }), {
      visibility_aabb: 'AABB(-1, -2, -3, 2, 4, 6)',
    });
    expect(result.visibilityAabb).toEqual({ position: { x: -1, y: -2, z: -3 }, size: { x: 2, y: 4, z: 6 } });
  });

  it('gives no box for a malformed visibility_aabb (error case)', () => {
    const result = parseParticles3D(heading('GPUParticles3D', { name: 'Sparks' }), {
      visibility_aabb: 'AABB(bad)',
    });
    expect(result.visibilityAabb).toBeNull();
  });

  it('gives no box for AABB(), which clears it (edge case)', () => {
    const result = parseParticles3D(heading('CPUParticles3D', { name: 'Sparks' }), {
      visibility_aabb: 'AABB(0, 0, 0, 0, 0, 0)',
      visibility_range_end: '20.0',
    });
    expect([result.visibilityAabb, result.visibilityRange.end]).toEqual([null, 20]);
  });
});
