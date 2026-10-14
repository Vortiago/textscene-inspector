/** FogMaterial decode, against `scene/resources/3d/fog_material.cpp`'s constructor and setters. */
import { describe, expect, it } from 'vitest';
import { decodeFogMaterial } from './decode';

describe('decodeFogMaterial', () => {
  it('reads an empty material as Godot constructs it', () => {
    expect(decodeFogMaterial({})).toEqual({
      density: 1,
      albedo: { r: 1, g: 1, b: 1, a: 1 },
      emission: { r: 0, g: 0, b: 0, a: 1 },
      heightFalloff: 0,
      edgeFade: 0.1,
      densityTexture: null,
    });
  });

  it('keeps a negative density, which carves fog out', () => {
    expect(decodeFogMaterial({ density: '-2.5' }).density).toBe(-2.5);
  });

  it('clamps a negative height falloff and edge fade to 0, as the setters do (edge case)', () => {
    expect(decodeFogMaterial({ height_falloff: '-1', edge_fade: '-3' })).toMatchObject({
      heightFalloff: 0,
      edgeFade: 0,
    });
  });

  it('keeps the density texture reference raw', () => {
    expect(decodeFogMaterial({ density_texture: 'SubResource("NoiseTexture3D_1")' }).densityTexture).toBe(
      'SubResource("NoiseTexture3D_1")'
    );
  });

  it('falls back to the default for a malformed albedo (error case)', () => {
    expect(decodeFogMaterial({ albedo: 'Color(oops)' }).albedo).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });
});
