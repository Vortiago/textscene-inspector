/** ParticleProcessMaterial decode: the emission shape with its offset and scale. */
import { describe, expect, it } from 'vitest';
import { decodeParticleProcessMaterial } from './decode';

describe('decodeParticleProcessMaterial', () => {
  it('reads an empty material as Godot constructs it (`particle_process_material.cpp:2405-2414`)', () => {
    expect(decodeParticleProcessMaterial({})).toEqual({
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

  it('reads the emission keys', () => {
    expect(
      decodeParticleProcessMaterial({ emission_shape: '3', emission_box_extents: 'Vector3(2, 1, 1)' })
    ).toMatchObject({ shape: 3, boxExtents: { x: 2, y: 1, z: 1 } });
  });

  it('reads the offset and the scale', () => {
    expect(
      decodeParticleProcessMaterial({
        emission_shape_offset: 'Vector3(0, 1, 0)',
        emission_shape_scale: 'Vector3(2, 1, 1)',
      })
    ).toMatchObject({ shapeOffset: { x: 0, y: 1, z: 0 }, shapeScale: { x: 2, y: 1, z: 1 } });
  });

  it('keeps a zero or negative scale, which the setter assigns bare (edge case)', () => {
    expect(decodeParticleProcessMaterial({ emission_shape_scale: 'Vector3(0, -1, 3)' }).shapeScale).toEqual({
      x: 0,
      y: -1,
      z: 3,
    });
  });

  it('falls back to the identity placement for a malformed offset and scale (error case)', () => {
    expect(
      decodeParticleProcessMaterial({ emission_shape_offset: '"up"', emission_shape_scale: 'Vector3(1)' })
    ).toMatchObject({ shapeOffset: { x: 0, y: 0, z: 0 }, shapeScale: { x: 1, y: 1, z: 1 } });
  });
});
