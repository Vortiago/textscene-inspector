/**
 * The one derivation both adapters read: which three material class a Godot feature set
 * needs, and its prop bag. Inputs are raw Godot property strings, so decode runs too.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  billboardOf,
  castsShadowOf,
  isAnisotropic,
  standardMaterialBags,
  surfaceBillboard,
} from './materialBag';
import { alphaHashScaleUserData } from '../../../r3f/materials/godotAlphaHash';
import { alphaAntialiasingOf } from '../../../r3f/materials/godotAlphaAntialiasing';
import { ambientOcclusionUserData } from '../../../r3f/materials/godotAmbientOcclusion';
import { lightModesUserData } from '../../../r3f/lightModes';
import { disablesSpecularOcclusion } from '../../../r3f/godotIndirectSpecular';
import { DiffuseMode } from '../../../godot/rendering/materials/diffuseMode';
import { SpecularMode } from '../../../godot/rendering/materials/specularMode';
import {
  DRAWN_OPAQUE_PREPASS,
  FADED_OPAQUE_PREPASS,
  NO_OPAQUE_PREPASS,
  opaquePrepassOf,
} from '../../../r3f/materials/opaquePrepass';
import { materialFromBag } from './build';
import { standardMaterial } from './testing/standardMaterial';
import { BillboardMode } from '../../../godot/rendering/materials/billboardMode';
import { parseStandardMaterial3DScalars } from './scalars';
import type { ResolvedTextures } from './types';
import { renderTargetMapUserData } from '../../../r3f/materials/renderTargetMap';
import {
  DRAWS_LAMBERT_DIFFUSE,
  KEEPS_REFLECTION_UNOCCLUDED,
  DRAWS_TOON_SPECULAR,
  DROPS_ALBEDO_ALPHA,
  OCCLUDES_DIRECT_LIGHT,
  REBUILDS_NORMAL_MAP_BLUE,
  WRITES_OPAQUE_AFTER_CUT,
  patchedFragment,
} from '../../../r3f/testing/patchedFragment';

function bag(properties: Record<string, string>, textures?: ResolvedTextures) {
  return standardMaterialBags(parseStandardMaterial3DScalars(properties), textures).unfaded;
}

/** The bag a geometry instance's fade below the threshold draws, in the alpha pass. */
function alphaPassBag(properties: Record<string, string> | null) {
  return standardMaterialBags(properties && parseStandardMaterial3DScalars(properties)).alphaPass;
}

describe('standardMaterialBags — the material class', () => {
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
    ['a metallic_specular past the default', { metallic_specular: '1' }],
  ])('upgrades to a physical material for %s', (_feature, properties) => {
    expect(bag(properties).materialClass).toBe('physical');
  });

  it('stays standard while every physical-only feature is off', () => {
    expect(bag({ clearcoat_enabled: 'true', clearcoat: '0' }).materialClass).toBe('standard');
  });
});

describe('standardMaterialBags — metallic_specular', () => {
  it("reflects Godot's dielectric F0 of 0.16 times metallic_specular squared", () => {
    // three's F0 is 0.04 at ior 1.5, times `specularIntensity` (`scene_forward_lights_inc.glsl:56`).
    const props = bag({ metallic_specular: '1' }).props as THREE.MeshPhysicalMaterialParameters;
    expect(0.04 * props.specularIntensity!).toBeCloseTo(0.16, 6);
  });

  it("keeps three's 0.04 at the default 0.5 (edge case)", () => {
    const derived = bag({ clearcoat_enabled: 'true' });
    expect((derived.props as THREE.MeshPhysicalMaterialParameters).specularIntensity).toBe(1);
  });

  it('reflects nothing from a dielectric at metallic_specular 0 (edge case)', () => {
    const props = bag({ metallic_specular: '0' }).props as THREE.MeshPhysicalMaterialParameters;
    expect(props.specularIntensity).toBe(0);
  });
});

describe('standardMaterialBags — scalar mapping', () => {
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

describe('standardMaterialBags — texture slots', () => {
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
    expect(derived.heightmapTexture).toBe(texture);
  });

  it("keeps the heightmap out of three's props, which displace no vertex", () => {
    const derived = bag({ heightmap_enabled: 'true' }, { heightmap_texture: texture });
    expect(derived.props).not.toHaveProperty('displacementMap');
  });

  it('carries no heightmap texture without heightmap_enabled (edge case)', () => {
    expect(bag({}, { heightmap_texture: texture }).heightmapTexture).toBeNull();
  });

  it('gives an empty slot a null, never an undefined', () => {
    expect((bag({}).props as THREE.MeshStandardMaterialParameters).map).toBeNull();
  });

  it('samples the flowmap only where three declares anisotropy', () => {
    // `anisotropyMap` exists on MeshPhysicalMaterial alone.
    const off = bag({}, { anisotropy_flowmap: texture });
    expect(off.props).not.toHaveProperty('anisotropyMap');
    const on = bag({ anisotropy_enabled: 'true', anisotropy: '0.5' }, { anisotropy_flowmap: texture });
    expect((on.props as THREE.MeshPhysicalMaterialParameters).anisotropyMap).toBe(texture);
  });

  it('drops every PBR slot on an unshaded material', () => {
    // Only albedo and the heightmap reach an unshaded material.
    const derived = bag({ shading_mode: '0' }, { albedo_texture: texture, normal_texture: texture });
    expect(derived.props.map).toBe(texture);
    expect(derived.props).not.toHaveProperty('normalMap');
  });

  it('shifts an unshaded material by its heightmap, as Godot does', () => {
    const derived = bag(
      { shading_mode: '0', heightmap_enabled: 'true' },
      { albedo_texture: texture, heightmap_texture: texture }
    );

    expect(derived.heightmapTexture).toBe(texture);
    expect(derived.injection?.cacheKey).toContain('godot-parallax');
  });
});

describe('standardMaterialBags — render-target albedo', () => {
  const target = new THREE.WebGLRenderTarget(4, 4).texture;
  const FLIPPED_V = { scale: { x: 1, y: -1 }, offset: { x: 0, y: 1 } };

  it.each([
    ['a lit', {}],
    ['an unshaded', { shading_mode: '0' }],
  ])('samples a render-target albedo through its UV transform on %s material', (_kind, properties) => {
    const derived = bag(properties, { albedo_texture: target, albedoTargetUv: FLIPPED_V });

    expect(derived.injection?.cacheKey).toContain('godot-target-map-uv');
    expect(derived.props.userData).toMatchObject(
      renderTargetMapUserData({ uv: FLIPPED_V, repeats: true, isNearest: false })
    );
  });

  it("wraps a render-target albedo under Godot's default texture_repeat", () => {
    expect(bag({}, { albedo_texture: target, albedoTargetUv: FLIPPED_V }).injection?.cacheKey).toContain(
      'godot_target_map_wraps'
    );
  });

  it('keeps a render-target albedo clamped under texture_repeat off', () => {
    const derived = bag({ texture_repeat: 'false' }, { albedo_texture: target, albedoTargetUv: FLIPPED_V });

    expect(derived.injection?.cacheKey).not.toContain('godot_target_map_wraps');
  });

  it.each(['0', '2', '4'])(
    'reads the nearest texel of a render-target albedo under texture_filter %s',
    (filter) => {
      const derived = bag({ texture_filter: filter }, { albedo_texture: target, albedoTargetUv: FLIPPED_V });

      expect(derived.injection?.cacheKey).toContain('godot_target_map_nearest');
    }
  );

  it('filters a render-target albedo linearly under a linear texture_filter', () => {
    const derived = bag({ texture_filter: '5' }, { albedo_texture: target, albedoTargetUv: FLIPPED_V });

    expect(derived.injection?.cacheKey).not.toContain('godot_target_map_nearest');
  });

  it("samples after the parallax shift, whose anchor the sample's inlined chunk replaces", () => {
    const derived = bag(
      { heightmap_enabled: 'true' },
      { albedo_texture: target, albedoTargetUv: FLIPPED_V, heightmap_texture: new THREE.Texture() }
    );

    expect(derived.injection?.cacheKey).toMatch(/godot-parallax.*godot-target-map-sample/);
  });

  it('patches nothing for an albedo that carries its own transform', () => {
    expect(bag({}, { albedo_texture: new THREE.Texture() }).injection).toBeUndefined();
  });
});

describe('standardMaterialBags — fragment alpha', () => {
  it('patches nothing on an opaque surface', () => {
    expect(bag({}).injection).toBeUndefined();
  });

  it('drops the texture alpha of an additive surface whose shader writes no ALPHA', () => {
    expect(patchedFragment(materialFromBag(bag({ blend_mode: '1' })))).toContain(DROPS_ALBEDO_ALPHA);
  });

  it('writes alpha 1 past the scissor cut of an additive surface', () => {
    expect(patchedFragment(materialFromBag(bag({ blend_mode: '1', transparency: '2' })))).toContain(
      WRITES_OPAQUE_AFTER_CUT
    );
  });
});

describe('standardMaterialBags — AO on direct light', () => {
  const aoMap = new THREE.Texture();
  const AO = { ao_enabled: 'true', ao_light_affect: '0.5' };

  it('occludes the direct light of a lit surface with an AO map', () => {
    expect(patchedFragment(materialFromBag(bag(AO, { ao_texture: aoMap })))).toContain(OCCLUDES_DIRECT_LIGHT);
  });

  it('records the light affect and the channel for the uniforms to read', () => {
    const built = materialFromBag(bag({ ...AO, ao_texture_channel: '1' }, { ao_texture: aoMap }));
    expect(built.userData).toMatchObject(ambientOcclusionUserData(0.5, [0, 1, 0, 0]));
  });

  it('occludes the direct light of a physical surface with an AO map', () => {
    const physical = bag({ ...AO, clearcoat_enabled: 'true' }, { ao_texture: aoMap });
    expect(physical.materialClass).toBe('physical');
    expect(patchedFragment(materialFromBag(physical))).toContain(OCCLUDES_DIRECT_LIGHT);
  });

  it('patches nothing on a surface with no AO map, whose sampler reads white', () => {
    // `material.cpp:1128`: `hint_default_white`, so AO is 1.
    expect(bag(AO).injection).toBeUndefined();
  });

  it('patches nothing on an unshaded surface, which has no lighting', () => {
    expect(bag({ ...AO, shading_mode: '0' }, { ao_texture: aoMap }).injection).toBeUndefined();
  });

  it('keeps the fragment-alpha patch beside the AO patch', () => {
    const fragment = patchedFragment(materialFromBag(bag({ ...AO, blend_mode: '1' }, { ao_texture: aoMap })));
    expect(fragment).toContain(OCCLUDES_DIRECT_LIGHT);
    expect(fragment).toContain(DROPS_ALBEDO_ALPHA);
  });
});

describe('standardMaterialBags — the normal map read', () => {
  const normalMap = new THREE.Texture();
  const NORMAL = { normal_enabled: 'true' };

  it('rebuilds the blue of a normal map from its red and green', () => {
    expect(patchedFragment(materialFromBag(bag(NORMAL, { normal_texture: normalMap })))).toContain(
      REBUILDS_NORMAL_MAP_BLUE
    );
  });

  it('patches nothing on a surface with no normal map', () => {
    expect(bag(NORMAL).injection).toBeUndefined();
  });

  it('rebuilds the blue on a physical surface too (edge case)', () => {
    const physical = bag({ ...NORMAL, clearcoat_enabled: 'true' }, { normal_texture: normalMap });
    expect(patchedFragment(materialFromBag(physical))).toContain(REBUILDS_NORMAL_MAP_BLUE);
  });
});

describe('standardMaterialBags — specular occlusion', () => {
  it('leaves the reflection of a surface that disables specular occlusion whole', () => {
    expect(patchedFragment(materialFromBag(bag({ disable_specular_occlusion: 'true' })))).toContain(
      KEEPS_REFLECTION_UNOCCLUDED
    );
  });

  it('patches nothing on a surface that keeps the default occlusion', () => {
    expect(bag({ disable_specular_occlusion: 'false' }).injection).toBeUndefined();
  });

  it('patches nothing on an unshaded surface, which has no reflection (edge case)', () => {
    expect(bag({ disable_specular_occlusion: 'true', shading_mode: '0' }).injection).toBeUndefined();
  });

  it('records the setting, for a decal to shade its projection with', () => {
    const material = materialFromBag(bag({ disable_specular_occlusion: 'true' }));
    expect(disablesSpecularOcclusion(material)).toBe(true);
  });
});

describe('standardMaterialBags — light modes', () => {
  it('records the modes, for a decal to shade its projection with', () => {
    expect(materialFromBag(bag({ diffuse_mode: '2', specular_mode: '1' })).userData).toMatchObject(
      lightModesUserData({
        diffuseMode: DiffuseMode.DIFFUSE_LAMBERT_WRAP,
        specularMode: SpecularMode.SPECULAR_TOON,
      })
    );
  });

  it("records Lambert and GGX on Godot's default surface", () => {
    expect(materialFromBag(standardMaterialBags(null).unfaded).userData).toMatchObject(
      lightModesUserData({
        diffuseMode: DiffuseMode.DIFFUSE_LAMBERT,
        specularMode: SpecularMode.SPECULAR_SCHLICK_GGX,
      })
    );
  });

  it('patches nothing for Burley and GGX, the terms the lighting chunk writes by default', () => {
    // `material.h:608-609`.
    expect(bag({}).injection).toBeUndefined();
  });

  it("writes a lit surface's diffuse in its authored mode", () => {
    expect(patchedFragment(materialFromBag(bag({ diffuse_mode: '1' })))).toContain(DRAWS_LAMBERT_DIFFUSE);
  });

  it("writes a lit surface's specular in its authored mode", () => {
    expect(patchedFragment(materialFromBag(bag({ specular_mode: '1' })))).toContain(DRAWS_TOON_SPECULAR);
  });

  it("writes a physical surface's diffuse in its authored mode too", () => {
    const physical = bag({ diffuse_mode: '1', clearcoat_enabled: 'true' });
    expect(physical.materialClass).toBe('physical');
    expect(patchedFragment(materialFromBag(physical))).toContain(DRAWS_LAMBERT_DIFFUSE);
  });

  it('patches nothing on an unshaded surface, which has no lighting', () => {
    expect(bag({ diffuse_mode: '1', shading_mode: '0' }).injection).toBeUndefined();
  });

  it("writes Godot's default surface in Lambert, as its shader names no diffuse mode (edge case)", () => {
    // `scene_shader_forward_clustered.cpp:910-925` names no diffuse mode, and `shader_types.cpp:241`
    // makes Lambert a spatial shader's default.
    expect(patchedFragment(materialFromBag(standardMaterialBags(null).unfaded))).toContain(
      DRAWS_LAMBERT_DIFFUSE
    );
  });

  it('keeps the AO patch beside the diffuse patch', () => {
    const textures = { ao_texture: new THREE.Texture() };
    const fragment = patchedFragment(
      materialFromBag(bag({ ao_enabled: 'true', diffuse_mode: '1' }, textures))
    );
    expect(fragment).toContain(DRAWS_LAMBERT_DIFFUSE);
    expect(fragment).toContain(OCCLUDES_DIRECT_LIGHT);
  });
});

describe('standardMaterialBags — the alpha pass', () => {
  it("blends Godot's default surface without a depth write", () => {
    expect(alphaPassBag(null).props).toMatchObject({ transparent: true, depthWrite: false, opacity: 1 });
  });

  it("leaves the alpha of Godot's default surface alone", () => {
    expect(patchedFragment(materialFromBag(alphaPassBag(null)))).not.toContain(DROPS_ALBEDO_ALPHA);
  });

  it("keeps the material's own alpha, for the cull to scale", () => {
    const { props } = alphaPassBag({ transparency: '1', albedo_color: 'Color(1, 1, 1, 0.5)' });
    expect(props.opacity).toBe(0.5);
  });

  it('leaves the unfaded bag as standardMaterialBags derives it (edge case)', () => {
    const scalars = parseStandardMaterial3DScalars({ albedo_color: 'Color(1, 1, 1, 0.5)' });
    expect(standardMaterialBags(scalars).unfaded).toEqual(standardMaterialBags(scalars).unfaded);
  });

  it("reads the material's own alpha-pass depth write", () => {
    expect(alphaPassBag({ depth_draw_mode: '1' }).props.depthWrite).toBe(true);
  });

  it('drops the texture alpha of an opaque material', () => {
    expect(patchedFragment(materialFromBag(alphaPassBag({})))).toContain(DROPS_ALBEDO_ALPHA);
  });

  it('overwrites past the scissor cut', () => {
    expect(alphaPassBag({ transparency: '2' }).props.blending).toBe(THREE.NoBlending);
  });
});

describe('standardMaterialBags — no material at all', () => {
  it('falls back to the surface Godot itself draws', () => {
    // Not a default-constructed StandardMaterial3D: every backend binds a
    // hardcoded shader: `ALBEDO = vec3(0.6); ROUGHNESS = 0.8; METALLIC = 0.2`.
    const derived = standardMaterialBags(null).unfaded;
    expect(derived.materialClass).toBe('standard');
    const props = derived.props as THREE.MeshStandardMaterialParameters;
    expect(props.color).toEqual(new THREE.Color().setRGB(0.6, 0.6, 0.6, THREE.LinearSRGBColorSpace));
    expect(props.roughness).toBe(0.8);
    expect(props.metalness).toBe(0.2);
    expect(props.side).toBe(THREE.FrontSide);
  });
});

describe('standardMaterialBags — billboard_mode', () => {
  it('carries the mode on the material, where each draw group reads it', () => {
    const built = standardMaterial({ billboard_mode: '2' });
    expect(billboardOf(built).mode).toBe(BillboardMode.BILLBOARD_FIXED_Y);
  });

  it('carries billboard_keep_scale beside the mode', () => {
    expect(
      billboardOf(standardMaterial({ billboard_mode: '1', billboard_keep_scale: 'true' })).keepScale
    ).toBe(true);
  });

  it('reads Godot’s default, no keep_scale, from a material that sets none', () => {
    expect(billboardOf(standardMaterial({ billboard_mode: '1' })).keepScale).toBe(false);
    expect(billboardOf(new THREE.MeshBasicMaterial()).keepScale).toBe(false);
  });

  it('reads DISABLED from a material that sets no billboard_mode', () => {
    expect(billboardOf(standardMaterial({})).mode).toBe(BillboardMode.BILLBOARD_DISABLED);
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
    expect(billboardOf(materialFromBag(standardMaterialBags(null).unfaded)).mode).toBe(
      BillboardMode.BILLBOARD_DISABLED
    );
    expect(billboardOf(new THREE.MeshBasicMaterial()).mode).toBe(BillboardMode.BILLBOARD_DISABLED);
  });

  it('reads the same billboard from the scalars as from the material built from them', () => {
    const scalars = parseStandardMaterial3DScalars({ billboard_mode: '2', billboard_keep_scale: 'true' });
    expect(surfaceBillboard(scalars)).toEqual(
      billboardOf(materialFromBag(standardMaterialBags(scalars).unfaded))
    );
  });

  it('reads DISABLED from no scalars, which is Godot’s default surface', () => {
    expect(surfaceBillboard(null)).toBe(billboardOf(new THREE.MeshBasicMaterial()));
  });

  it('gives each bag its own userData, as the .tres loader writes into it', () => {
    const scalars = parseStandardMaterial3DScalars({ billboard_mode: '1' });
    expect(standardMaterialBags(scalars).unfaded.props.userData).not.toBe(
      standardMaterialBags(scalars).unfaded.props.userData
    );
  });
});

describe('standardMaterialBags — shadow-pass membership', () => {
  it('carries the decoded membership on the material, where each draw group reads it', () => {
    const built = standardMaterial({ transparency: '1' });
    expect(castsShadowOf(built)).toBe(false);
  });

  it('casts from an opaque material', () => {
    expect(castsShadowOf(standardMaterial({}))).toBe(true);
  });

  it('casts from Godot’s default surface and from a foreign material', () => {
    expect(castsShadowOf(materialFromBag(standardMaterialBags(null).unfaded))).toBe(true);
    expect(castsShadowOf(new THREE.MeshBasicMaterial())).toBe(true);
  });
});

describe('standardMaterialBags — alpha hash', () => {
  it('hashes an ALPHA_HASH material at its authored grain', () => {
    const built = standardMaterial({ transparency: '3', alpha_hash_scale: '0.4' });
    expect(built.alphaHash).toBe(true);
    expect(built.userData).toMatchObject(alphaHashScaleUserData(0.4));
  });

  it('keeps an ALPHA_HASH material in the opaque pass', () => {
    expect(standardMaterial({ transparency: '3' }).transparent).toBe(false);
  });

  it('hashes nothing on a material with no transparency (edge case)', () => {
    expect(standardMaterial({}).alphaHash).toBe(false);
  });
});

describe('standardMaterialBags — alpha antialiasing', () => {
  const scissorAntialiased = (mode: string) => ({
    transparency: '2',
    shading_mode: '0',
    alpha_antialiasing_mode: mode,
    alpha_antialiasing_edge: '0.2',
  });

  it.each([
    ['ALPHA_TO_COVERAGE', '1', THREE.SrcAlphaFactor],
    ['ALPHA_TO_COVERAGE_AND_TO_ONE', '2', THREE.OneFactor],
  ])('turns alpha to coverage on with its blend under %s', (_name, mode, blendSrc) => {
    const built = standardMaterial(scissorAntialiased(mode));
    expect(built).toMatchObject({ alphaToCoverage: true, blending: THREE.CustomBlending, blendSrc });
  });

  it.each([
    ['ALPHA_TO_COVERAGE', '1'],
    ['ALPHA_TO_COVERAGE_AND_TO_ONE', '2'],
  ])('ramps the edge past the scissor under %s', (_name, mode) => {
    const built = standardMaterial(scissorAntialiased(mode));
    expect(alphaAntialiasingOf(built)?.edge).toBeCloseTo(0.7, 6);
    expect(patchedFragment(built)).toContain('godotEdgeCoverage(');
  });

  it('keeps alpha to coverage on in the alpha pass a fade forces', () => {
    const props = alphaPassBag(scissorAntialiased('1')).props;
    expect(props.alphaToCoverage).toBe(true);
    expect(alphaAntialiasingOf({ userData: props.userData as Record<string, unknown> })).not.toBeNull();
  });

  it("blends with the material's own blend mode while the mode is OFF", () => {
    const built = standardMaterial({ transparency: '2', blend_mode: '1' });
    expect(built).toMatchObject({ alphaToCoverage: false, blending: THREE.AdditiveBlending });
    expect(alphaAntialiasingOf(built)).toBeNull();
  });

  it('replaces an authored blend mode with the alpha-to-coverage blend (edge case)', () => {
    // `scene_shader_forward_clustered.cpp:237-241`, and the editor hides `blend_mode` (`material.cpp:2655`).
    const built = standardMaterial({ ...scissorAntialiased('1'), blend_mode: '1' });
    expect(built.blending).toBe(THREE.CustomBlending);
  });
});

describe('standardMaterialBags — opaque prepass', () => {
  it('has the depth prepass draw an unfaded DEPTH_PRE_PASS surface', () => {
    expect(opaquePrepassOf(materialFromBag(bag({ transparency: '4' })))).toBe(DRAWN_OPAQUE_PREPASS);
  });

  it('keeps a faded DEPTH_PRE_PASS surface out of the depth prepass but cuts its shadow', () => {
    // A fade below 0.999 forces the alpha pass (`render_forward_clustered.cpp:1128-1134`).
    expect(opaquePrepassOf(materialFromBag(alphaPassBag({ transparency: '4' })))).toBe(FADED_OPAQUE_PREPASS);
  });

  it('gives a blended surface no opaque prepass (edge case)', () => {
    expect(opaquePrepassOf(materialFromBag(bag({ transparency: '1' })))).toBe(NO_OPAQUE_PREPASS);
  });
});

describe('isAnisotropic', () => {
  const anisotropic = (properties: Record<string, string>) =>
    isAnisotropic(parseStandardMaterial3DScalars(properties));

  it('draws a positive anisotropy anisotropic', () => {
    expect(anisotropic({ anisotropy_enabled: 'true', anisotropy: '0.5' })).toBe(true);
  });

  it('draws a negative anisotropy anisotropic, as either sign scales the flowmap (edge case)', () => {
    expect(anisotropic({ anisotropy_enabled: 'true', anisotropy: '-0.5' })).toBe(true);
  });

  it('draws a strength without anisotropy_enabled isotropic (error case)', () => {
    expect(anisotropic({ anisotropy: '0.5' })).toBe(false);
  });
});
