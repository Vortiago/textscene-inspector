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

  it("reads the emission keys with Godot's defaults for the gizmo", () => {
    expect(parse({}).emission).toEqual({
      shape: 0,
      sphereRadius: 1,
      boxExtents: { x: 1, y: 1, z: 1 },
      ringAxis: { x: 0, y: 0, z: 1 },
      ringHeight: 1,
      ringRadius: 1,
      ringInnerRadius: 0,
      ringConeAngle: 90,
      shapeOffset: { x: 0, y: 0, z: 0 },
      shapeScale: { x: 1, y: 1, z: 1 },
    });
  });

  it('reads an authored ring', () => {
    expect(
      parse({
        emission_shape: '6',
        emission_ring_axis: 'Vector3(0, 1, 0)',
        emission_ring_height: '2.0',
        emission_ring_radius: '1.5',
        emission_ring_inner_radius: '0.5',
        emission_ring_cone_angle: '45.0',
      }).emission
    ).toMatchObject({
      shape: 6,
      ringAxis: { x: 0, y: 1, z: 0 },
      ringHeight: 2,
      ringRadius: 1.5,
      ringInnerRadius: 0.5,
      ringConeAngle: 45,
    });
  });

  it('keeps a malformed emission key at its default (error case)', () => {
    expect(parse({ emission_shape: '"ring"', emission_sphere_radius: 'x' }).emission).toMatchObject({
      shape: 0,
      sphereRadius: 1,
    });
  });
});
