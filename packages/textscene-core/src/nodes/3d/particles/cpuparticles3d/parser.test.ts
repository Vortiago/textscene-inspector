import { describe, expect, it } from 'vitest';
import { heading } from '../../../../parser/testing/parserKit';
import { parseCPUParticles3D } from './parser';

const parse = (properties: Record<string, string>) =>
  parseCPUParticles3D(heading('CPUParticles3D', { name: 'Sparks' }), properties);

describe('parseCPUParticles3D', () => {
  it('reads visibility_aabb as the emitter box', () => {
    expect(parse({ visibility_aabb: 'AABB(-1, -2, -3, 2, 4, 6)' }).visibilityAabb).toEqual({
      position: { x: -1, y: -2, z: -3 },
      size: { x: 2, y: 4, z: 6 },
    });
  });

  it('gives no box for a malformed visibility_aabb (error case)', () => {
    expect(parse({ visibility_aabb: 'AABB(bad)' }).visibilityAabb).toBeNull();
  });

  it('gives no box for AABB(), which clears it (edge case)', () => {
    const result = parse({ visibility_aabb: 'AABB(0, 0, 0, 0, 0, 0)', visibility_range_end: '20.0' });
    expect([result.visibilityAabb, result.visibilityRange.end]).toEqual([null, 20]);
  });

  it('reads whether mesh holds a mesh, and null as none', () => {
    expect([parse({ mesh: 'SubResource("Box")' }).hasMesh, parse({ mesh: 'null' }).hasMesh]).toEqual([
      true,
      false,
    ]);
  });
});
