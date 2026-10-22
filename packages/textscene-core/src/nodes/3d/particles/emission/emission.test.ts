/** The emission keys ParticleProcessMaterial and CPUParticles3D share, read with the constructors' defaults. */
import { describe, expect, it } from 'vitest';
import { readParticleEmission } from './emission';

describe('readParticleEmission', () => {
  it('reads an empty bag as the constructors leave it (`particle_process_material.cpp:2405-2412`)', () => {
    expect(readParticleEmission({})).toEqual({
      shape: 0,
      sphereRadius: 1,
      boxExtents: { x: 1, y: 1, z: 1 },
      ringAxis: { x: 0, y: 0, z: 1 },
      ringHeight: 1,
      ringRadius: 1,
      ringInnerRadius: 0,
      ringConeAngle: 90,
    });
  });

  it('reads every authored key', () => {
    expect(
      readParticleEmission({
        emission_shape: '6',
        emission_sphere_radius: '0.5',
        emission_box_extents: 'Vector3(2, 0.5, 1)',
        emission_ring_axis: 'Vector3(0, 1, 0)',
        emission_ring_height: '2.0',
        emission_ring_radius: '1.5',
        emission_ring_inner_radius: '0.5',
        emission_ring_cone_angle: '45.0',
      })
    ).toEqual({
      shape: 6,
      sphereRadius: 0.5,
      boxExtents: { x: 2, y: 0.5, z: 1 },
      ringAxis: { x: 0, y: 1, z: 0 },
      ringHeight: 2,
      ringRadius: 1.5,
      ringInnerRadius: 0.5,
      ringConeAngle: 45,
    });
  });

  it('holds a real at single precision, as a real_t field does', () => {
    expect(readParticleEmission({ emission_sphere_radius: '0.1' }).sphereRadius).toBe(Math.fround(0.1));
  });

  it('keeps Point for a shape index past the enum, which set_emission_shape refuses (edge case)', () => {
    expect(readParticleEmission({ emission_shape: '7' }).shape).toBe(0);
    expect(readParticleEmission({ emission_shape: '-1' }).shape).toBe(0);
  });

  it('keeps zero, negative and large values, which the setters assign bare (edge case)', () => {
    expect(
      readParticleEmission({
        emission_sphere_radius: '0.0',
        emission_ring_height: '-2.0',
        emission_ring_radius: '1000.0',
      })
    ).toMatchObject({ sphereRadius: 0, ringHeight: -2, ringRadius: 1000 });
  });

  it('falls back to the default for a malformed value (error case)', () => {
    expect(
      readParticleEmission({
        emission_shape: '"ring"',
        emission_sphere_radius: '"big"',
        emission_box_extents: 'Vector3(oops)',
      })
    ).toMatchObject({ shape: 0, sphereRadius: 1, boxExtents: { x: 1, y: 1, z: 1 } });
  });
});
