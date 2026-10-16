import { describe, expect, it } from 'vitest';
import { TextureFilter } from '../rendering/materials/textureFilter';
import { BASE_MATERIAL_3D_DEFAULTS, EMISSION_OPERATOR_DEFAULT } from './baseMaterial3D';
import { EmissionOperator } from '../rendering/materials/emissionOperator';

/** `BaseMaterial3D::BaseMaterial3D` (`scene/resources/material.cpp:3937-4000`). */
describe('BASE_MATERIAL_3D_DEFAULTS', () => {
  it('starts a surface rough, dielectric and half specular', () => {
    expect(BASE_MATERIAL_3D_DEFAULTS).toMatchObject({ roughness: 1, metallic: 0, specular: 0.5 });
  });

  it('sets the rim, clearcoat and normal scale defaults', () => {
    expect(BASE_MATERIAL_3D_DEFAULTS).toMatchObject({
      normalScale: 1,
      rim: 1,
      rimTint: 0.5,
      clearcoat: 1,
      clearcoatRoughness: 0.5,
    });
  });

  it('cuts alpha at 0.5 and hashes at scale 1', () => {
    expect(BASE_MATERIAL_3D_DEFAULTS).toMatchObject({ alphaScissorThreshold: 0.5, alphaHashScale: 1 });
  });

  it('maps height over 8 to 32 layers at scale 5', () => {
    expect(BASE_MATERIAL_3D_DEFAULTS).toMatchObject({
      heightmapScale: 5,
      heightmapMinLayers: 8,
      heightmapMaxLayers: 32,
    });
  });

  it('leaves AO off direct light and refracts at 0.05', () => {
    expect(BASE_MATERIAL_3D_DEFAULTS).toMatchObject({ aoLightAffect: 0, refractionScale: 0.05 });
  });

  it('samples with mipmapped linear filtering (material.h:600)', () => {
    expect(BASE_MATERIAL_3D_DEFAULTS.textureFilter).toBe(TextureFilter.LINEAR_WITH_MIPMAPS);
  });

  it('adds emission by default', () => {
    expect(EMISSION_OPERATOR_DEFAULT).toBe(EmissionOperator.ADD);
  });
});
