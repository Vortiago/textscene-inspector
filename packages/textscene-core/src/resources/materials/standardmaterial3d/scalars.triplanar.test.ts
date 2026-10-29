/**
 * StandardMaterial3D triplanar mapping: each UV set that projects the vertex position, with its
 * scale, offset, blend sharpness and space, and the space of the tangent frame
 * (`material.cpp:1386-1454`).
 */
import { describe, expect, it } from 'vitest';
import { parseStandardMaterial3DScalars } from './scalars';

describe('parseStandardMaterial3DScalars: triplanar mapping', () => {
  it('projects UV1 at Godot defaults under uv1_triplanar', () => {
    expect(parseStandardMaterial3DScalars({ uv1_triplanar: 'true' }).triplanar).toEqual({
      uv1: { scale: { x: 1, y: 1, z: 1 }, offset: { x: 0, y: 0, z: 0 }, sharpness: 1, isWorld: false },
      uv2: null,
      isTangentWorld: false,
    });
  });

  it('keeps every component of uv1_scale and uv1_offset, as Godot scales the position', () => {
    const { triplanar } = parseStandardMaterial3DScalars({
      uv1_triplanar: 'true',
      uv1_scale: 'Vector3(0.5, 3, 2)',
      uv1_offset: 'Vector3(0.25, -1, 4)',
    });

    expect(triplanar?.uv1?.scale).toEqual({ x: 0.5, y: 3, z: 2 });
    expect(triplanar?.uv1?.offset).toEqual({ x: 0.25, y: -1, z: 4 });
  });

  it('projects the world position under uv1_world_triplanar', () => {
    const { triplanar } = parseStandardMaterial3DScalars({
      uv1_triplanar: 'true',
      uv1_world_triplanar: 'true',
    });

    expect(triplanar?.uv1?.isWorld).toBe(true);
    expect(triplanar?.isTangentWorld).toBe(true);
  });

  it('clamps the sharpness to 0..150, as the setter does (material.cpp:2786)', () => {
    const sharpness = (value: string) =>
      parseStandardMaterial3DScalars({ uv1_triplanar: 'true', uv1_triplanar_sharpness: value }).triplanar?.uv1
        ?.sharpness;

    expect(sharpness('0')).toBe(0);
    expect(sharpness('150')).toBe(150);
    expect(sharpness('400')).toBe(150);
    expect(sharpness('-2')).toBe(0);
  });

  it('projects UV2 with its own transform, sharpness and space', () => {
    const { triplanar } = parseStandardMaterial3DScalars({
      uv2_triplanar: 'true',
      uv2_world_triplanar: 'true',
      uv2_scale: 'Vector3(4, 2, 1)',
      uv2_offset: 'Vector3(0.5, 0.25, 0)',
      uv2_triplanar_sharpness: '3',
    });

    expect(triplanar).toEqual({
      uv1: null,
      uv2: { scale: { x: 4, y: 2, z: 1 }, offset: { x: 0.5, y: 0.25, z: 0 }, sharpness: 3, isWorld: true },
      isTangentWorld: false,
    });
  });

  it('takes the frame space from uv1_world_triplanar when only UV2 projects (material.cpp:1388-1414)', () => {
    const { triplanar } = parseStandardMaterial3DScalars({
      uv2_triplanar: 'true',
      uv1_world_triplanar: 'true',
    });

    expect(triplanar?.uv1).toBeNull();
    expect(triplanar?.isTangentWorld).toBe(true);
  });

  it('maps nothing when uv1_world_triplanar is on alone, as it only picks the space (edge case)', () => {
    expect(parseStandardMaterial3DScalars({ uv1_world_triplanar: 'true' }).triplanar).toBeNull();
  });

  it('maps nothing by default', () => {
    expect(parseStandardMaterial3DScalars({}).triplanar).toBeNull();
    expect(parseStandardMaterial3DScalars({ uv1_triplanar: 'false' }).triplanar).toBeNull();
  });
});
