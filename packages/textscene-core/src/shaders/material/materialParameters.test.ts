import { describe, expect, it } from 'vitest';
import {
  bool,
  int,
  real,
  variant,
  vector2,
  vector3,
  type Variant,
} from '../../godot/variant/value/variant.js';
import { materialParameters, textureParameterOf } from './materialParameters.js';
import { materialStateOf, type MaterialSettings } from './materialProperties.js';

const parametersOf = (settings: MaterialSettings) =>
  materialParameters(materialStateOf('StandardMaterial3D', settings));

describe('materialParameters', () => {
  it("gives each parameter the constructor's value when no property is set", () => {
    const parameters = parametersOf({});

    expect(parameters).toMatchObject({
      albedo: variant('COLOR', { r: 1, g: 1, b: 1, a: 1 }),
      specular: real(0.5),
      roughness: real(1),
      emission_energy: real(1),
      refraction: real(0.05),
      alpha_antialiasing_edge: real(0.3),
      fov_override: real(75),
    });
  });

  it('gives an int uniform the int its setter passes', () => {
    expect(parametersOf({ particles_anim_h_frames: 4 })).toMatchObject({
      heightmap_min_layers: int(8),
      heightmap_max_layers: int(32),
      particles_anim_h_frames: int(4),
      particles_anim_v_frames: int(1),
    });
  });

  const INT32_MIN = int(-2147483648);
  const NON_FINITE_ROWS: readonly (readonly [string, number, string, Variant])[] = [
    ['roughness', Number.NaN, 'roughness', real(Number.NaN)],
    ['roughness', Infinity, 'roughness', real(Infinity)],
    ['roughness', -Infinity, 'roughness', real(-Infinity)],
    ['heightmap_min_layers', Number.NaN, 'heightmap_min_layers', INT32_MIN],
    ['heightmap_min_layers', Infinity, 'heightmap_min_layers', INT32_MIN],
    ['heightmap_min_layers', -Infinity, 'heightmap_min_layers', INT32_MIN],
    ['particles_anim_loop', Number.NaN, 'particles_anim_loop', bool(true)],
    ['particles_anim_loop', Infinity, 'particles_anim_loop', bool(true)],
    ['particles_anim_loop', -Infinity, 'particles_anim_loop', bool(true)],
    ['uv1_triplanar_sharpness', Number.NaN, 'uv1_blend_sharpness', real(Number.NaN)],
    ['uv1_triplanar_sharpness', Infinity, 'uv1_blend_sharpness', real(150)],
    ['uv1_triplanar_sharpness', -Infinity, 'uv1_blend_sharpness', real(0)],
    ['proximity_fade_distance', Number.NaN, 'proximity_fade_distance', real(0.01)],
    ['proximity_fade_distance', Infinity, 'proximity_fade_distance', real(Infinity)],
    ['proximity_fade_distance', -Infinity, 'proximity_fade_distance', real(0.01)],
    ['heightmap_flip_tangent', Number.NaN, 'heightmap_flip', vector2({ x: -1, y: 1 })],
  ];

  it.each(NON_FINITE_ROWS)(
    "gives %s = %s the %s Godot's setter casts it to",
    (property, value, parameter, expected) => {
      expect(parametersOf({ [property]: value })[parameter]).toEqual(expected);
    }
  );

  it('keeps each non-finite lane of a vector and a colour, as the setters store them', () => {
    const lanes = [Number.NaN, Infinity, -Infinity];
    const parameters = parametersOf({ uv1_scale: lanes, albedo_color: [...lanes, 1] });

    expect(parameters.uv1_scale).toEqual(vector3({ x: Number.NaN, y: Infinity, z: -Infinity }));
    expect(parameters.albedo).toEqual(variant('COLOR', { r: Number.NaN, g: Infinity, b: -Infinity, a: 1 }));
  });

  it('copies a property into the parameter Godot names after it', () => {
    const parameters = parametersOf({
      albedo_color: [0.2, 0.4, 0.6, 0.8],
      metallic_specular: 0.25,
      anisotropy: -0.5,
      grow_amount: 2,
      refraction_scale: -0.3,
      distance_fade_max_distance: 40,
    });

    expect(parameters).toMatchObject({
      albedo: variant('COLOR', { r: 0.2, g: 0.4, b: 0.6, a: 0.8 }),
      specular: real(0.25),
      anisotropy_ratio: real(-0.5),
      grow: real(2),
      refraction: real(-0.3),
      distance_fade_max: real(40),
    });
  });

  it("gives a texture channel the mask of Godot's `_get_texture_mask`", () => {
    const parameters = parametersOf({ metallic_texture_channel: 1, ao_texture_channel: 4 });

    expect(parameters.metallic_texture_channel).toEqual(variant('VECTOR4', { x: 0, y: 1, z: 0, w: 0 }));
    expect(parameters.ao_texture_channel).toEqual(
      variant('VECTOR4', { x: 0.3333333, y: 0.3333333, z: 0.3333333, w: 0 })
    );
    expect(parameters.refraction_texture_channel).toEqual(variant('VECTOR4', { x: 1, y: 0, z: 0, w: 0 }));
  });

  it('clamps a triplanar sharpness to 0 to 150 and a proximity fade distance to at least 0.01', () => {
    const parameters = parametersOf({
      uv1_triplanar_sharpness: 200,
      uv2_triplanar_sharpness: -1,
      proximity_fade_distance: 0,
    });

    expect(parameters.uv1_blend_sharpness).toEqual(real(150));
    expect(parameters.uv2_blend_sharpness).toEqual(real(0));
    expect(parameters.proximity_fade_distance).toEqual(real(0.01));
  });

  it('negates each flipped lane of the heightmap', () => {
    expect(parametersOf({}).heightmap_flip).toEqual(vector2({ x: 1, y: 1 }));
    expect(parametersOf({ heightmap_flip_binormal: true }).heightmap_flip).toEqual(vector2({ x: 1, y: -1 }));
  });

  it('writes a bool as a bool and a vector property as a vector', () => {
    const parameters = parametersOf({ particles_anim_loop: true, uv1_scale: [2, 3, 4] });

    expect(parameters.particles_anim_loop).toEqual(bool(true));
    expect(parameters.uv1_scale).toEqual(vector3({ x: 2, y: 3, z: 4 }));
  });

  it("names each texture property's sampler parameter, and none for another property", () => {
    expect(textureParameterOf('albedo_texture')).toBe('texture_albedo');
    expect(textureParameterOf('anisotropy_flowmap')).toBe('texture_flowmap');
    expect(textureParameterOf('albedo_color')).toBeUndefined();
  });

  it('names no sampler for a property that shares a name with an Object member', () => {
    expect(textureParameterOf('constructor')).toBeUndefined();
  });
});
