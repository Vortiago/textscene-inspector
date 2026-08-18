/**
 * StandardMaterial3D types — the decoded form (`StandardMaterial3DData`, pure
 * Godot semantics) and the three-flavoured view both renderers apply
 * (`StandardMaterial3DScalars`).
 *
 * Every `three` reference here is TYPE-ONLY, so `index.ts` can re-export this
 * module without pulling a renderer into a linter's import closure
 * (`walkImportClosure` skips erased imports; ADR-0031).
 */

import type * as THREE from 'three';
import type { EmissionScalars } from './emission';

// One Color declaration repo-wide; re-exported here because this slice's
// consumers (sky, environment, preview lighting) historically imported it
// from this module.
export type { Color } from '../../../utils/colorParser';

/** Godot `BaseMaterial3D.Transparency`. */
export enum Transparency {
  DISABLED = 0,
  /** Alpha blending; gives up depth writes so surfaces behind stay visible. */
  ALPHA = 1,
  /** Hard cutout at `alpha_scissor_threshold`, on the opaque pass. */
  ALPHA_SCISSOR = 2,
  /** Stochastic cutout, on the opaque pass. */
  ALPHA_HASH = 3,
  /** Alpha blending after a depth prepass, so it DOES write depth. */
  ALPHA_DEPTH_PRE_PASS = 4,
}

/** Godot `BaseMaterial3D.BlendMode` — the same enum `CanvasItemMaterial` uses. */
export enum BlendMode {
  MIX = 0,
  ADD = 1,
  SUB = 2,
  MUL = 3,
  PREMULT_ALPHA = 4,
}

/** Godot `BaseMaterial3D.CullMode`. BACK culls back faces, i.e. draws the front. */
export enum CullMode {
  BACK = 0,
  FRONT = 1,
  DISABLED = 2,
}

/**
 * Godot `BaseMaterial3D.DepthDrawMode`. OPAQUE_ONLY is the default and means
 * "write depth in the opaque pass only" — a surface that lands in the alpha pass
 * under it writes none.
 */
export enum DepthDrawMode {
  OPAQUE_ONLY = 0,
  ALWAYS = 1,
  DISABLED = 2,
}

/**
 * The texture slots this slice renders, in the order the node component's hooks
 * call them. Each is the Godot property name, because that is what the decode
 * reads and what an `ExtResource` / `SubResource` reference is keyed by.
 *
 * Godot's remaining `BaseMaterial3D` slots (detail, backlight, refraction,
 * clearcoat, subsurface scattering, transmittance) have no wired three analog,
 * so enumerating them would produce references nothing can apply.
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
 * A resolved texture per slot; absent or null both mean "nothing in that slot".
 * Every one arrives ALREADY BOUND — see `textureBinding.ts`.
 */
export type ResolvedTextureSlots = Partial<Record<TextureSlot, THREE.Texture | null>>;

/**
 * A texture slot's raw reference string (`ExtResource("1_x")`,
 * `SubResource("NoiseTexture2D_y")`, a bare `res://` path), present only when
 * the slot's feature gate is on. Resolving a reference to a real texture is the
 * arrival path's job — the inline path reads the scene's tables, the `.tres`
 * path reads the owning file's — which is why decode stops at the string.
 */
export type TextureSlotReferences = Readonly<Partial<Record<TextureSlot, string>>>;

/** `uv1_scale` / `uv1_offset` / `normal_scale`, reduced to the two axes UVs use. */
export interface MaterialVec2 {
  x: number;
  y: number;
}

/**
 * The decoded material: Godot's own semantics, no renderer types. One decode
 * feeds both arrival paths (inline `[sub_resource]` text and an external
 * `.tres`), which is what makes the two agree by construction rather than by
 * hand-syncing (ADR-0031).
 */
export interface StandardMaterial3DData {
  /**
   * `albedo_color` RGB converted sRGB→linear, NOT clamped: Godot declares
   * `uniform vec4 albedo : source_color` behind a plain
   * `PropertyInfo(Variant::COLOR, "albedo_color")` with no range hint
   * (material.cpp), so HDR channels above 1 are legal and reach the shader.
   */
  albedo: [number, number, number];
  /** `albedo_color` alpha, clamped 0..1 (the shader's ALPHA is a coverage term). */
  alpha: number;
  /** `metallic`, clamped 0..1 per its `PROPERTY_HINT_RANGE "0,1,0.01"`. */
  metallic: number;
  /** `roughness`, clamped 0..1 per its `PROPERTY_HINT_RANGE "0,1,0.01"`. */
  roughness: number;
  /** `emission` × `emission_energy_multiplier`, gated on `emission_enabled`. */
  emission: EmissionScalars;
  /** `emission_operator`: 0 ADD (default), 1 MULTIPLY. */
  emissionOperator: number;
  /** `texture_filter` — the sampler state every slot on this material samples with. */
  textureFilter: number;
  /** `texture_repeat` (default true) — whether a UV outside 0..1 tiles or clamps. */
  textureRepeat: boolean;
  uv1Scale: MaterialVec2;
  uv1Offset: MaterialVec2;
  /** The authored `transparency` mode. */
  transparency: Transparency;
  /**
   * Whether the surface renders in Godot's ALPHA pass — its `uses_alpha_pass()`
   * ported, so `blend_mode`, refraction, the fades and the depth flags all get a
   * say, not `transparency` alone. See `decode.ts` for the transcription.
   */
  transparent: boolean;
  /** ALPHA_SCISSOR cutoff (`alpha_scissor_threshold`, 0..1); 0 = no cutout. */
  alphaTest: number;
  /** The authored `depth_draw_mode`, with refraction's forced ALWAYS applied. */
  depthDrawMode: DepthDrawMode;
  /** Whether this surface's fragments reach the depth buffer. */
  depthWrite: boolean;
  /** Godot `no_depth_test` inverted — false means the surface draws through everything. */
  depthTest: boolean;
  blendMode: BlendMode;
  cullMode: CullMode;
  /**
   * Whether `cull_mode` was authored at all. Lets a consumer apply a
   * per-mesh-type default only where the material expressed no opinion.
   */
  cullModeExplicit: boolean;
  /** `shading_mode`: 'unshaded' (mode 0, unlit) or 'per_pixel' (default). */
  shadingMode: 'unshaded' | 'per_pixel';
  /** `vertex_color_use_as_albedo` (default false). */
  useVertexColors: boolean;
  /** `ao_enabled` — the AO slot only applies when true. */
  aoEnabled: boolean;
  /** `normal_enabled` — the normal slot only applies when true. */
  normalEnabled: boolean;
  /** `normal_scale`, as the uniform XY pair three's `normalScale` wants. */
  normalScale: MaterialVec2;
  /** `uv1_triplanar` OR `uv1_world_triplanar`. */
  triplanar: boolean;
  /** `clearcoat` strength (0..1), gated on `clearcoat_enabled`. */
  clearcoat: number;
  /** `clearcoat_roughness` (0..1), gated on `clearcoat_enabled`. */
  clearcoatRoughness: number;
  /** `rim` strength (0..1), gated on `rim_enabled`. */
  rim: number;
  /** `rim_tint` (0..1, blend light↔albedo), gated on `rim_enabled`. */
  rimTint: number;
  /**
   * `heightmap_scale`, gated on `heightmap_enabled` (0 when off). NOT clamped
   * to 0..1 — its hint is `"-16,16,0.001"`, a depth factor that may invert.
   */
  heightmapScale: number;
  /**
   * `billboard_mode`: 0 DISABLED, 1 ENABLED, 2 FIXED_Y, 3 PARTICLES. Fed
   * straight to `useBillboard`, the same hook Label3D/Sprite3D drive.
   */
  billboardMode: number;
  /**
   * `billboard_keep_scale`. Godot's default (false) normalises the model scale
   * away while billboarding; `useBillboard` only rewrites rotation, so our
   * billboard always keeps the authored scale. Decoded for completeness.
   */
  billboardKeepScale: boolean;
  /** `anisotropy` magnitude (0..1), gated on `anisotropy_enabled`. */
  anisotropy: number;
  /** `anisotropy` direction: 0 when positive, π/2 when negative. */
  anisotropyRotation: number;
  /** three's `transmission` — 1 when `refraction_enabled`, 0 otherwise. */
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
 * The three-flavoured view of a decoded material: everything a
 * `<meshStandardMaterial>` / `<meshPhysicalMaterial>` / `<meshBasicMaterial>`
 * needs that does not require an async texture fetch.
 *
 * Shared by the two adapters over the one decode — `<StandardMaterialSlot>`
 * (reactive) and `build.ts` (imperative) — so a property cannot mean one thing
 * in JSX and another in the loader.
 */
export interface StandardMaterial3DScalars extends EmissionScalars, MaterialBlendState {
  /** Linear RGB, unclamped (see `StandardMaterial3DData.albedo`). */
  color: [number, number, number];
  opacity: number;
  metalness: number;
  roughness: number;
  emissionOperator: number;
  textureFilter: number;
  textureRepeat: boolean;
  uv1Scale: MaterialVec2;
  uv1Offset: MaterialVec2;
  transparent: boolean;
  alphaTest: number;
  depthWrite: boolean;
  depthTest: boolean;
  shadingMode: 'unshaded' | 'per_pixel';
  useVertexColors: boolean;
  aoEnabled: boolean;
  normalEnabled: boolean;
  side: THREE.Side;
  cullModeExplicit: boolean;
  normalScale: MaterialVec2;
  triplanar: boolean;
  clearcoat: number;
  clearcoatRoughness: number;
  rim: number;
  rimTint: number;
  heightmapScale: number;
  billboardMode: number;
  billboardKeepScale: boolean;
  anisotropy: number;
  anisotropyRotation: number;
  transmission: number;
  refractionThickness: number;
  /** Slot → raw reference string, carried through for the loader's resolution. */
  textureSlots: TextureSlotReferences;
}
