/**
 * The one derivation both adapters read: which three material class a Godot feature set
 * needs, and its prop bag. Inputs are raw Godot property strings, so decode runs too.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { billboardOf, castsShadowOf, standardMaterialBag, surfaceBillboard } from './materialBag';
import { materialFromBag } from './build';
import { standardMaterial } from './testing/standardMaterial';
import { BillboardMode } from '../../../godot/billboard';
import { parseStandardMaterial3DScalars } from './scalars';
import type { ResolvedTextureSlots } from './types';

function bag(properties: Record<string, string>, textures?: ResolvedTextureSlots) {
  return standardMaterialBag(parseStandardMaterial3DScalars(properties), textures);
}

describe('standardMaterialBag — the material class', () => {
  it('derives a standard material for a plain PBR surface', () => {
    const derived = bag({ metallic: '0.7', roughness: '0.25' });
    expect(derived.materialClass).toBe('standard');
    const props = derived.props as THREE.MeshStandardMaterialParameters;
    expect(props.metalness).toBe(0.7);
    expect(props.roughness).toBe(0.25);
  });

  it('derives a basic material for SHADING_MODE_UNSHADED', () => {
    // Godot's unshaded branch writes `frag_color = vec4(albedo, alpha)`, so no
    // PBR term reaches the output. three's unlit material is the equivalent.
    const derived = bag({ shading_mode: '0', emission_enabled: 'true', emission: 'Color(1, 0, 0, 1)' });
    expect(derived.materialClass).toBe('basic');
    expect(derived.props).not.toHaveProperty('emissive');
    expect(derived.props).not.toHaveProperty('metalness');
  });

  it.each([
    ['FEATURE_CLEARCOAT', { clearcoat_enabled: 'true', clearcoat: '0.8' }],
    ['FEATURE_RIM', { rim_enabled: 'true', rim: '0.6' }],
    ['FEATURE_ANISOTROPY', { anisotropy_enabled: 'true', anisotropy: '0.5' }],
    ['FEATURE_REFRACTION', { refraction_enabled: 'true' }],
  ])('upgrades to a physical material for %s', (_feature, properties) => {
    expect(bag(properties).materialClass).toBe('physical');
  });

  it('stays standard while every physical-only feature is off', () => {
    expect(bag({ clearcoat_enabled: 'true', clearcoat: '0' }).materialClass).toBe('standard');
  });
});

describe('standardMaterialBag — scalar mapping', () => {
  it('keeps albedo LINEAR', () => {
    // Authored inside sRGB's linear segment (`c <= 0.04045 → c / 12.92`), so
    // the decoded channels are exact: 0.0025 / 0.0015 / 0.0005. A hex would take
    // them through `setHex(…, SRGBColorSpace)` and decode them a second time.
    const { color } = bag({ albedo_color: 'Color(0.0323, 0.01938, 0.00646, 1)' }).props;
    expect(color).toBeInstanceOf(THREE.Color);
    const rgb = color as THREE.Color;
    expect(rgb.r).toBeCloseTo(0.0025, 6);
    expect(rgb.g).toBeCloseTo(0.0015, 6);
    expect(rgb.b).toBeCloseTo(0.0005, 6);
  });

  it('blends the rim highlight from the light colour toward the albedo', () => {
    // Godot's `light_compute`: `diffuse_light += rim_light * rim *
    // mix(vec3(1.0), albedo, rim_tint)`, so tint 0 keeps the light colour and 1 the
    // linear albedo, in three's `sheenColor`. The albedo sits in sRGB's linear segment,
    // so `mix(1, 0.0025, 0.5)` is exact.
    const derived = bag({
      rim_enabled: 'true',
      rim: '0.6',
      rim_tint: '0.5',
      albedo_color: 'Color(0.0323, 0.01938, 0.00646, 1)',
    });
    expect(derived.materialClass).toBe('physical');
    const props = derived.props as THREE.MeshPhysicalMaterialParameters;
    expect(props.sheen).toBe(0.6);
    const sheen = props.sheenColor as THREE.Color;
    expect(sheen.r).toBeCloseTo(0.50125, 6);
    expect(sheen.g).toBeCloseTo(0.50075, 6);
    expect(sheen.b).toBeCloseTo(0.50025, 6);
    // A low sheenRoughness keeps the effect at grazing angles, so it reads as an
    // edge rim rather than a broad fabric glow.
    expect(props.sheenRoughness).toBe(0.1);
  });

  it('omits the blend factors a three preset already carries', () => {
    // `Material.setValues` warns on an undefined parameter and R3F assigns
    // whatever it is given, so an omitted factor must be absent, not undefined.
    const preset = bag({ blend_mode: '0' });
    expect(preset.props.blending).toBe(THREE.NormalBlending);
    expect(preset.props).not.toHaveProperty('blendSrc');
    // SUB has no three preset: CustomBlending plus all six factors.
    const custom = bag({ blend_mode: '2' });
    expect(custom.props.blending).toBe(THREE.CustomBlending);
    expect(custom.props.blendSrc).toBe(THREE.SrcAlphaFactor);
  });
});

describe('standardMaterialBag — texture slots', () => {
  const texture = new THREE.Texture();

  it('maps each Godot slot onto the three prop that samples it', () => {
    const derived = bag(
      { normal_enabled: 'true', ao_enabled: 'true', heightmap_enabled: 'true' },
      {
        albedo_texture: texture,
        normal_texture: texture,
        roughness_texture: texture,
        metallic_texture: texture,
        emission_texture: texture,
        ao_texture: texture,
        heightmap_texture: texture,
      }
    );
    const props = derived.props as THREE.MeshStandardMaterialParameters;
    expect(props.map).toBe(texture);
    expect(props.normalMap).toBe(texture);
    expect(props.roughnessMap).toBe(texture);
    expect(props.metalnessMap).toBe(texture);
    expect(props.emissiveMap).toBe(texture);
    expect(props.aoMap).toBe(texture);
    expect(props.displacementMap).toBe(texture);
  });

  it('gives an empty slot a null, never an undefined', () => {
    expect((bag({}).props as THREE.MeshStandardMaterialParameters).map).toBeNull();
  });

  it('samples the flowmap only where three declares anisotropy', () => {
    // `anisotropyMap` exists on MeshPhysicalMaterial alone.
    const off = bag({}, { anisotropy_flowmap: texture });
    expect(off.props).not.toHaveProperty('anisotropyMap');
    const on = bag(
      { anisotropy_enabled: 'true', anisotropy: '0.5' },
      { anisotropy_flowmap: texture }
    );
    expect((on.props as THREE.MeshPhysicalMaterialParameters).anisotropyMap).toBe(texture);
  });

  it('drops every PBR slot on an unshaded material', () => {
    // Only albedo reaches a MeshBasicMaterial.
    const derived = bag({ shading_mode: '0' }, { albedo_texture: texture, normal_texture: texture });
    expect(derived.props.map).toBe(texture);
    expect(derived.props).not.toHaveProperty('normalMap');
  });
});

describe('standardMaterialBag — no material at all', () => {
  it('falls back to the surface Godot itself draws', () => {
    // Not a default-constructed StandardMaterial3D: every backend binds a
    // hardcoded shader: `ALBEDO = vec3(0.6); ROUGHNESS = 0.8; METALLIC = 0.2`.
    const derived = standardMaterialBag(null);
    expect(derived.materialClass).toBe('standard');
    const props = derived.props as THREE.MeshStandardMaterialParameters;
    expect(props.color).toEqual(new THREE.Color().setRGB(0.6, 0.6, 0.6, THREE.LinearSRGBColorSpace));
    expect(props.roughness).toBe(0.8);
    expect(props.metalness).toBe(0.2);
    expect(props.side).toBe(THREE.FrontSide);
  });
});

describe('standardMaterialBag — billboard_mode', () => {
  it('carries the mode on the material, where each draw group reads it', () => {
    const built = standardMaterial({ billboard_mode: '2' });
    expect(billboardOf(built).mode).toBe(BillboardMode.BILLBOARD_FIXED_Y);
  });

  it('carries billboard_keep_scale beside the mode', () => {
    expect(billboardOf(standardMaterial({ billboard_mode: '1', billboard_keep_scale: 'true' })).keepScale).toBe(true);
  });

  it('reads Godot’s default, no keep_scale, from a material that sets none', () => {
    expect(billboardOf(standardMaterial({ billboard_mode: '1' })).keepScale).toBe(false);
    expect(billboardOf(new THREE.MeshBasicMaterial()).keepScale).toBe(false);
  });

  it('reads DISABLED from a material that sets no billboard_mode', () => {
    expect(billboardOf(standardMaterial({})).mode).toBe(
      BillboardMode.BILLBOARD_DISABLED
    );
  });

  it('hands back one shared billboard for every surface that does not billboard', () => {
    // The draw hooks read it every draw group, so a non-billboard read must not allocate.
    expect(billboardOf(standardMaterial({}))).toBe(billboardOf(new THREE.MeshBasicMaterial()));
  });

  it('reads DISABLED from a billboard_mode that no shader case billboards', () => {
    expect(billboardOf(standardMaterial({ billboard_mode: '7' }))).toBe(
      billboardOf(new THREE.MeshBasicMaterial())
    );
  });

  it('reads PARTICLES as a billboard', () => {
    expect(billboardOf(standardMaterial({ billboard_mode: '3' })).mode).toBe(
      BillboardMode.BILLBOARD_PARTICLES
    );
  });

  it('reads DISABLED from Godot’s default surface and from a foreign material', () => {
    expect(billboardOf(materialFromBag(standardMaterialBag(null))).mode).toBe(BillboardMode.BILLBOARD_DISABLED);
    expect(billboardOf(new THREE.MeshBasicMaterial()).mode).toBe(BillboardMode.BILLBOARD_DISABLED);
  });

  it('reads the same billboard from the scalars as from the material built from them', () => {
    const scalars = parseStandardMaterial3DScalars({ billboard_mode: '2', billboard_keep_scale: 'true' });
    expect(surfaceBillboard(scalars)).toEqual(billboardOf(materialFromBag(standardMaterialBag(scalars))));
  });

  it('reads DISABLED from no scalars, which is Godot’s default surface', () => {
    expect(surfaceBillboard(null)).toBe(billboardOf(new THREE.MeshBasicMaterial()));
  });

  it('gives each bag its own userData, as the .tres loader writes into it', () => {
    const scalars = parseStandardMaterial3DScalars({ billboard_mode: '1' });
    expect(standardMaterialBag(scalars).props.userData).not.toBe(standardMaterialBag(scalars).props.userData);
  });
});

describe('standardMaterialBag — shadow-pass membership', () => {
  it('carries the decoded membership on the material, where each draw group reads it', () => {
    const built = standardMaterial({ transparency: '1' });
    expect(castsShadowOf(built)).toBe(false);
  });

  it('casts from an opaque material', () => {
    expect(castsShadowOf(standardMaterial({}))).toBe(true);
  });

  it('casts from Godot’s default surface and from a foreign material', () => {
    expect(castsShadowOf(materialFromBag(standardMaterialBag(null)))).toBe(true);
    expect(castsShadowOf(new THREE.MeshBasicMaterial())).toBe(true);
  });
});
