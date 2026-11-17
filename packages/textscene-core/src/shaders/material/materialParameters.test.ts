import { describe, expect, it } from 'vitest';
import { materialParameters } from './materialParameters.js';
import { materialStateOf, type MaterialSettings } from './materialProperties.js';

const parametersOf = (settings: MaterialSettings) =>
  materialParameters(materialStateOf('StandardMaterial3D', settings));

describe('materialParameters', () => {
  it("gives each parameter the constructor's value when no property is set", () => {
    const parameters = parametersOf({});

    expect(parameters).toMatchObject({
      albedo: [1, 1, 1, 1],
      specular: 0.5,
      roughness: 1,
      emission_energy: 1,
      refraction: 0.05,
      heightmap_min_layers: 8,
      heightmap_max_layers: 32,
      alpha_antialiasing_edge: 0.3,
      fov_override: 75,
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
      albedo: [0.2, 0.4, 0.6, 0.8],
      specular: 0.25,
      anisotropy_ratio: -0.5,
      grow: 2,
      refraction: -0.3,
      distance_fade_max: 40,
    });
  });

  it("gives a texture channel the mask of Godot's `_get_texture_mask`", () => {
    const parameters = parametersOf({ metallic_texture_channel: 1, ao_texture_channel: 4 });

    expect(parameters.metallic_texture_channel).toEqual([0, 1, 0, 0]);
    expect(parameters.ao_texture_channel).toEqual([0.3333333, 0.3333333, 0.3333333, 0]);
    expect(parameters.refraction_texture_channel).toEqual([1, 0, 0, 0]);
  });

  it('clamps a triplanar sharpness to 0 to 150 and a proximity fade distance to at least 0.01', () => {
    const parameters = parametersOf({
      uv1_triplanar_sharpness: 200,
      uv2_triplanar_sharpness: -1,
      proximity_fade_distance: 0,
    });

    expect(parameters.uv1_blend_sharpness).toBe(150);
    expect(parameters.uv2_blend_sharpness).toBe(0);
    expect(parameters.proximity_fade_distance).toBe(0.01);
  });

  it('negates each flipped lane of the heightmap', () => {
    expect(parametersOf({}).heightmap_flip).toEqual([1, 1]);
    expect(parametersOf({ heightmap_flip_binormal: true }).heightmap_flip).toEqual([1, -1]);
  });

  it('binds each texture and sizes the albedo from its texture', () => {
    const albedo = { width: 64, height: 32 };
    const normal = { width: 8, height: 8 };

    const parameters = parametersOf({ albedo_texture: albedo, normal_texture: normal });

    expect(parameters.texture_albedo).toBe(albedo);
    expect(parameters.texture_normal).toBe(normal);
    expect(parameters.albedo_texture_size).toEqual([64, 32]);
  });

  it('sets no texture parameter for a texture the material does not hold', () => {
    expect(parametersOf({})).not.toHaveProperty('texture_albedo');
    expect(parametersOf({})).not.toHaveProperty('albedo_texture_size');
  });
});
