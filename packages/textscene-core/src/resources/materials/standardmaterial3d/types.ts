/**
 * The decoded material (`StandardMaterial3DData`) and the three-flavoured view
 * both renderers apply (`StandardMaterial3DScalars`). Every `three` reference is
 * type-only, so `index.ts` re-exports this module with no renderer in a linter's
 * import closure (`walkImportClosure` skips erased imports; ADR-0031).
 */

import type * as THREE from 'three';
import type { EmissionScalars } from './emission';
import type { TextureChannel, TextureChannelMask } from '../../../godot/rendering/materials/textureChannel';
import type { Vector2 } from '../../../godot/math/vector';
import { BASE_MATERIAL_3D_DEFAULTS } from '../../../godot/scene/baseMaterial3D';
import type { BlendMode } from '../../../godot/rendering/materials/blendMode';
import type { CullMode } from '../../../godot/rendering/materials/cullMode';
import type { DepthDrawMode } from '../../../godot/rendering/materials/depthDrawMode';
import type { Transparency } from '../../../godot/rendering/materials/transparency';
import type { AlphaAntialiasingCut } from '../../../godot/rendering/materials/alphaAntialiasing';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

/** Godot's height mapping of a surface. */
export interface Heightmap {
  /** `heightmap_scale`, unclamped, as the setter stores it (`material.cpp:2283-2286`). */
  scale: number;
  /** `heightmap_deep_parallax`: steps through layers, where the default takes one offset. */
  isDeep: boolean;
  /** `heightmap_min_layers` and `heightmap_max_layers`, the steps at a head-on and a grazing view. */
  layers: [min: number, max: number];
  /** `heightmap_flip_tangent` and `heightmap_flip_binormal`, as -1 or 1. */
  flip: [tangent: number, binormal: number];
  /** `heightmap_flip_texture`: the texture holds height, where the default holds depth. */
  readsHeight: boolean;
}

/** Godot's height mapping defaults (`material.cpp:3952`, `:3995-3997`). */
export const HEIGHTMAP_DEFAULTS: Heightmap = {
  scale: BASE_MATERIAL_3D_DEFAULTS.heightmapScale,
  isDeep: false,
  layers: [BASE_MATERIAL_3D_DEFAULTS.heightmapMinLayers, BASE_MATERIAL_3D_DEFAULTS.heightmapMaxLayers],
  flip: [1, 1],
  readsHeight: false,
};

/**
 * The texture slots this slice renders, in the order the component's hooks call
 * them, keyed by Godot property name. The other `BaseMaterial3D` slots (detail,
 * backlight, refraction, clearcoat, subsurface scattering, transmittance) have no
 * wired three analogue, so a reference to one has nothing to apply it.
 */
export const TEXTURE_SLOTS = [
  'albedo_texture',
  'normal_texture',
  'roughness_texture',
  'metallic_texture',
  'emission_texture',
  'ao_texture',
  'heightmap_texture',
  'anisotropy_flowmap',
] as const;
export type TextureSlot = (typeof TEXTURE_SLOTS)[number];

/**
 * The bound textures a material derives from, one per slot. Absent and null both mean "nothing in
 * that slot". Every one arrives already bound by `textureBinding.ts`.
 */
export type ResolvedTextures = Partial<Record<TextureSlot, THREE.Texture | null>>;

/**
 * A slot's raw reference (`ExtResource("1_x")`, `SubResource("NoiseTexture2D_y")`,
 * a bare `res://` path), present only when the slot's feature gate is on. Decode
 * stops at the string: the inline path resolves it against the scene's tables,
 * the `.tres` path against the owning file's.
 */
export type TextureSlotReferences = Readonly<Partial<Record<TextureSlot, string>>>;

/**
 * The decoded material: Godot's own semantics, no renderer types. One decode
 * feeds both arrival paths (inline `[sub_resource]` text and an external
 * `.tres`), which is what makes the two agree by construction rather than by
 * hand-syncing (ADR-0031).
 */
export interface StandardMaterial3DData {
  /**
   * `albedo_color` RGB converted sRGB→linear, not clamped: Godot declares
   * `uniform vec4 albedo : source_color` behind a plain
   * `PropertyInfo(Variant::COLOR, "albedo_color")` with no range hint
   * (material.cpp), so HDR channels above 1 are legal and reach the shader.
   */
  albedo: [number, number, number];
  /**
   * `albedo_color` alpha, clamped 0..1, where the shader multiplies it into ALPHA. 1 where
   * the shader never reads it: transparency DISABLED with no fade, or refraction.
   */
  alpha: number;
  /** `metallic`, clamped 0..1 per its `PROPERTY_HINT_RANGE "0,1,0.01"`. */
  metallic: number;
  /** `roughness`, clamped 0..1 per its `PROPERTY_HINT_RANGE "0,1,0.01"`. */
  roughness: number;
  /** `metallic_specular`, unclamped: a dielectric's F0 is `0.16 * specular * specular`. */
  specular: number;
  /** `emission` × `emission_energy_multiplier`, gated on `emission_enabled`. */
  emission: EmissionScalars;
  /** `emission_operator`: 0 ADD (default), 1 MULTIPLY. */
  emissionOperator: number;
  /** `texture_filter`: the sampler state every slot on this material samples with. */
  textureFilter: number;
  /** `texture_repeat` (default true): whether a UV outside 0..1 tiles or clamps. */
  textureRepeat: boolean;
  uv1Scale: Vector2;
  uv1Offset: Vector2;
  /** `uv2_scale`, identity where Godot never applies it (see `decode.ts`). */
  uv2Scale: Vector2;
  /** `uv2_offset`, identity where Godot never applies it. */
  uv2Offset: Vector2;
  /** `uv2_triplanar`: triplanar mapping of the second UV set. */
  uv2Triplanar: boolean;
  /** The slots that sample UV2 (`emission_on_uv2`, `ao_on_uv2`). */
  uv2Slots: readonly TextureSlot[];
  /** The authored `transparency` mode. */
  transparency: EnumValue<typeof Transparency>;
  /**
   * Whether the surface renders in Godot's alpha pass: its `uses_alpha_pass()`
   * ported, so `blend_mode`, refraction, the fades and the depth flags all get a
   * say, not `transparency` alone. See `decode.ts` for the transcription.
   */
  transparent: boolean;
  /**
   * Whether the surface joins Godot's shadow pass: `!uses_alpha_pass() ||
   * uses_depth_in_alpha_pass()`, the `FLAG_PASS_SHADOW` rule.
   */
  castsShadow: boolean;
  /** ALPHA_SCISSOR cutoff (`alpha_scissor_threshold`, 0..1). 0 means no cutout. */
  alphaTest: number;
  /** Whether ALPHA_HASH cuts the alpha the shader writes. */
  alphaHash: boolean;
  /** `alpha_hash_scale`: the hash's grain, which `material.cpp:1840` hands the shader. */
  alphaHashScale: number;
  /** The cutout's alpha antialiasing, or null where its shader runs none. */
  alphaAntialiasing: AlphaAntialiasingCut | null;
  /** The authored `depth_draw_mode`, with refraction's forced ALWAYS applied. */
  depthDrawMode: EnumValue<typeof DepthDrawMode>;
  /** Whether this surface's fragments reach the depth buffer. */
  depthWrite: boolean;
  /**
   * Whether the surface writes depth once its geometry instance's `transparency` moves it to the
   * alpha pass, which skips the depth prepass too: DEPTH_DRAW_ALWAYS with the depth test on.
   */
  alphaPassDepthWrite: boolean;
  /**
   * `uses_depth_in_alpha_pass()`: an alpha-pass surface the depth prepass draws, and whose depth
   * draws cut at `opaque_prepass_threshold`.
   */
  depthInAlphaPass: boolean;
  /** Whether the shader multiplies the albedo colour, texture and vertex alpha into ALPHA. */
  readsAlbedoAlpha: boolean;
  /** Whether Godot writes alpha 1 for each fragment the surface's cut keeps. */
  opaqueAfterCut: boolean;
  /** Godot `no_depth_test` inverted: false means the surface draws through everything. */
  depthTest: boolean;
  blendMode: EnumValue<typeof BlendMode>;
  cullMode: EnumValue<typeof CullMode>;
  /**
   * Whether `cull_mode` was authored at all. Lets a consumer apply a
   * per-mesh-type default only where the material expressed no opinion.
   */
  cullModeExplicit: boolean;
  /** `shading_mode`: 'unshaded' (mode 0, unlit) or 'per_pixel' (default). */
  shadingMode: 'unshaded' | 'per_pixel';
  /** `diffuse_mode`, a `DiffuseMode`. The setter stores it unchecked, so it can lie past the enum. */
  diffuseMode: number;
  /** `specular_mode`, a `SpecularMode`, unchecked likewise. */
  specularMode: number;
  /** `vertex_color_use_as_albedo` (default false). */
  useVertexColors: boolean;
  /** `disable_specular_occlusion` (default false): a dim ambient leaves the reflection whole. */
  disablesSpecularOcclusion: boolean;
  /** `ao_light_affect`: how far the occlusion also occludes direct light, 0 without `ao_enabled`. Unclamped, as the setter is. */
  aoLightAffect: number;
  /** `ao_texture_channel`: the AO map channel the shader reads. */
  aoTextureChannel: EnumValue<typeof TextureChannel>;
  /** `roughness_texture_channel`: the roughness map channel the shader reads. */
  roughnessTextureChannel: EnumValue<typeof TextureChannel>;
  /** `metallic_texture_channel`: the metallic map channel the shader reads. */
  metallicTextureChannel: EnumValue<typeof TextureChannel>;
  /** `normal_scale`, as the uniform XY pair three's `normalScale` wants. */
  normalScale: Vector2;
  /** `uv1_triplanar`: triplanar mapping of the first UV set. */
  triplanar: boolean;
  /** `clearcoat` strength (0..1), gated on `clearcoat_enabled`. */
  clearcoat: number;
  /** `clearcoat_roughness` (0..1), gated on `clearcoat_enabled`. */
  clearcoatRoughness: number;
  /** `rim` strength (0..1), gated on `rim_enabled`. */
  rim: number;
  /** `rim_tint` (0..1, blend light↔albedo), gated on `rim_enabled`. */
  rimTint: number;
  /** Height mapping, null when `heightmap_enabled` is off or triplanar mapping overrides it. */
  heightmap: Heightmap | null;
  /** `use_point_size` (default false): the shader writes `point_size` as POINT_SIZE and samples albedo at POINT_COORD. */
  usesPointSize: boolean;
  /** `point_size` in pixels (default 1). The setter checks no range, as the inspector's 0.1-128 is only a hint. */
  pointSize: number;
  /**
   * `billboard_mode`: 0 DISABLED, 1 ENABLED, 2 FIXED_Y, 3 PARTICLES. The derived
   * material carries it on `userData`, and `r3f/surfaceDrawHooks.ts` poses each draw.
   */
  billboardMode: number;
  /**
   * `billboard_keep_scale`. Godot's default (false) drops the model scale while
   * billboarding (`material.cpp:1274-1281`). It rides the built material's `userData`.
   */
  billboardKeepScale: boolean;
  /**
   * `anisotropy` (−1..1), gated on `anisotropy_enabled`. The sign picks the axis the highlight
   * stretches along: the tangent when positive, the bitangent when negative.
   */
  anisotropy: number;
  /** three's `transmission`: 1 when `refraction_enabled`, 0 otherwise. */
  transmission: number;
  /** three's `thickness`, from `refraction_scale`, clamped ≥ 0. */
  refractionThickness: number;
  /** Slot → raw reference string, for the slots whose feature gate is on. */
  textureSlots: TextureSlotReferences;
}

/**
 * three's blending state for one Godot `blend_mode`, spelled with three's own
 * material property names so it can be spread onto a material or a JSX slot.
 * The factor fields are absent for the modes a three preset already expresses
 * exactly (see `blendState.ts`).
 */
export interface MaterialBlendState {
  blending: THREE.Blending;
  blendEquation?: THREE.BlendingEquation;
  blendSrc?: THREE.BlendingSrcFactor;
  blendDst?: THREE.BlendingDstFactor;
  blendEquationAlpha?: THREE.BlendingEquation;
  blendSrcAlpha?: THREE.BlendingSrcFactor;
  blendDstAlpha?: THREE.BlendingDstFactor;
}

/**
 * The three-flavoured view of a decoded material: everything a three material
 * needs that no async texture fetch provides. `<StandardMaterialSlot>` and
 * `build.ts` share it, so a property cannot mean one thing in JSX and another
 * in the loader.
 */
export interface StandardMaterial3DScalars extends EmissionScalars, MaterialBlendState {
  /** Linear RGB, unclamped (see `StandardMaterial3DData.albedo`). */
  color: [number, number, number];
  opacity: number;
  metalness: number;
  roughness: number;
  specular: number;
  emissionOperator: number;
  textureFilter: number;
  textureRepeat: boolean;
  uv1Scale: Vector2;
  uv1Offset: Vector2;
  uv2Scale: Vector2;
  uv2Offset: Vector2;
  uv2Triplanar: boolean;
  uv2Slots: readonly TextureSlot[];
  transparent: boolean;
  castsShadow: boolean;
  alphaTest: number;
  alphaHash: boolean;
  alphaHashScale: number;
  alphaAntialiasing: AlphaAntialiasingCut | null;
  depthWrite: boolean;
  alphaPassDepthWrite: boolean;
  depthInAlphaPass: boolean;
  readsAlbedoAlpha: boolean;
  opaqueAfterCut: boolean;
  depthTest: boolean;
  shadingMode: 'unshaded' | 'per_pixel';
  diffuseMode: number;
  specularMode: number;
  useVertexColors: boolean;
  disablesSpecularOcclusion: boolean;
  aoLightAffect: number;
  aoTextureChannelMask: TextureChannelMask;
  roughnessTextureChannelMask: TextureChannelMask;
  metallicTextureChannelMask: TextureChannelMask;
  side: THREE.Side;
  cullModeExplicit: boolean;
  normalScale: Vector2;
  triplanar: boolean;
  clearcoat: number;
  clearcoatRoughness: number;
  rim: number;
  rimTint: number;
  heightmap: Heightmap | null;
  usesPointSize: boolean;
  pointSize: number;
  billboardMode: number;
  billboardKeepScale: boolean;
  anisotropy: number;
  transmission: number;
  refractionThickness: number;
  /** Slot → raw reference string, carried through for the loader's resolution. */
  textureSlots: TextureSlotReferences;
}
