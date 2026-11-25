import { describe, expect, it } from 'vitest';
import { bool, real, variant, vector2, vector3 } from '../../godot/variant/value/variant.js';
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
      heightmap_min_layers: real(8),
      heightmap_max_layers: real(32),
      alpha_antialiasing_edge: real(0.3),
      fov_override: real(75),
    });
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
