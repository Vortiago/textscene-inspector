/**
 * One StandardMaterial3D → one three material description: the class and its prop bag.
 * `build.ts` and `<StandardMaterialSlot>` read only this, so both mean the same thing.
 * Each adapter binds textures first (`textureBinding.ts`). It value-imports `three`, so `index.ts`
 * never imports it.
 */

import * as THREE from 'three';
import {
  GODOT_DEFAULT_ALBEDO,
  GODOT_DEFAULT_METALLIC,
  GODOT_DEFAULT_ROUGHNESS,
} from '../../../r3f/materials/godotDefaultMaterial';
import { BillboardMode } from '../../../godot/billboard';
import { surfaceFadeVariants, type FadeVariants, type PassAlpha } from '../../../r3f/materials/fadeVariants';
import { composeInjections, type ProgramInjection } from '../../../r3f/materialProgramInputs';
import { alphaHashScaleUserData } from '../../../r3f/materials/godotAlphaHash';
import { recordedOn } from '../../../r3f/materials/recordedOnMaterial';
import {
  GODOT_AMBIENT_OCCLUSION,
  ambientOcclusionUserData,
} from '../../../r3f/materials/godotAmbientOcclusion';
import {
  DRAWN_OPAQUE_PREPASS,
  FADED_OPAQUE_PREPASS,
  NO_OPAQUE_PREPASS,
  opaquePrepassUserData,
  type OpaquePrepass,
} from '../../../r3f/materials/opaquePrepass';
import { resolveEmission } from './emission';
import type {
  MaterialBlendState,
  ResolvedTextureSlots,
  StandardMaterial3DScalars,
  TextureSlot,
} from './types';

// Godot's default COLOR buffer is white (`mesh_storage.cpp:86-97`). three declares it on
// ShaderMaterial alone, so another class reads (0,0,0) and blacks out albedo. On the
// prototype, as `copy` drops it, and here, as this module mints every material that can
// read the default.
(THREE.Material.prototype as { defaultAttributeValues?: Record<string, number[]> }).defaultAttributeValues = {
  color: [1, 1, 1],
};

/** Which three material class a feature set needs. */
export type StandardMaterialClass = 'basic' | 'standard' | 'physical';

/**
 * The class and its props as one discriminated value, so an adapter cannot map a class
 * to parameters it did not derive. No `attach`, the reactive adapter's mount detail, and
 * no React `key`, which `materialProgramInputs` derives from the merged bag (ADR-0038).
 * `injection` composes the program patches the surface needs, which each adapter installs.
 */
export type StandardMaterialBag = (
  | { materialClass: 'basic'; props: THREE.MeshBasicMaterialParameters }
  | { materialClass: 'standard'; props: THREE.MeshStandardMaterialParameters }
  | { materialClass: 'physical'; props: THREE.MeshPhysicalMaterialParameters }
) & { injection?: ProgramInjection };

/**
 * Godot's default 3D material, which a surface with no material draws. A hardcoded
 * shader, not a default StandardMaterial3D, so it has no scalars (`godotDefaultMaterial.ts`).
 */
const NO_MATERIAL: StandardMaterialBag = {
  materialClass: 'standard',
  props: {
    color: GODOT_DEFAULT_ALBEDO,
    metalness: GODOT_DEFAULT_METALLIC,
    roughness: GODOT_DEFAULT_ROUGHNESS,
    side: THREE.FrontSide,
  },
};

/**
 * Godot's default surface writes no ALPHA, and its three bag binds no map and no vertex colours, so
 * three's alpha is `opacity` alone too: no patch, as for a shader that reads the albedo alpha. It
 * writes depth in the opaque pass only.
 */
const NO_MATERIAL_ALPHA = { readsAlbedoAlpha: true, opaqueAfterCut: false, alphaPassDepthWrite: false };

/**
 * The previewer's marker for a surface whose texture never draws: a file that cannot load,
 * or a ViewportTexture albedo whose pass is cyclic. Godot has no such material.
 */
export const MISSING_TEXTURE_MATERIAL: StandardMaterialBag = {
  materialClass: 'standard',
  props: { color: 'magenta' },
};

/**
 * `MeshPhysicalMaterial` is needed for clearcoat, rim → sheen, anisotropy or refraction →
 * transmission. A three capability mapping, as Godot has one spatial shader, so a new
 * physical-only feature extends this set.
 */
function needsPhysicalMaterial(scalars: StandardMaterial3DScalars): boolean {
  return scalars.clearcoat > 0 || scalars.rim > 0 || scalars.anisotropy > 0 || scalars.transmission > 0;
}

/**
 * `rim_tint` blends the rim highlight from the light colour (0) toward the
 * albedo (1); three's closest native term is `sheenColor`.
 */
function rimSheenColor(scalars: StandardMaterial3DScalars): THREE.Color {
  const tint = scalars.rimTint;
  return new THREE.Color(
    1 + tint * (scalars.color[0] - 1),
    1 + tint * (scalars.color[1] - 1),
    1 + tint * (scalars.color[2] - 1)
  );
}

/**
 * A low `sheenRoughness` concentrates the sheen toward grazing angles, so the
 * effect reads as an edge rim rather than a broad fabric glow that would wash a
 * dark-albedo sphere out to bright grey.
 */
const RIM_SHEEN_ROUGHNESS = 0.1;

/**
 * The blending fields, with the factor fields omitted where a three preset carries them.
 * Omitted, not `undefined`: `Material.setValues` warns on one, and R3F would assign it
 * over three's own blending state.
 */
function materialBlendProps(scalars: StandardMaterial3DScalars): MaterialBlendState {
  const props: MaterialBlendState = { blending: scalars.blending };
  if (scalars.blendEquation !== undefined) props.blendEquation = scalars.blendEquation;
  if (scalars.blendSrc !== undefined) props.blendSrc = scalars.blendSrc;
  if (scalars.blendDst !== undefined) props.blendDst = scalars.blendDst;
  if (scalars.blendEquationAlpha !== undefined) {
    props.blendEquationAlpha = scalars.blendEquationAlpha;
  }
  if (scalars.blendSrcAlpha !== undefined) props.blendSrcAlpha = scalars.blendSrcAlpha;
  if (scalars.blendDstAlpha !== undefined) props.blendDstAlpha = scalars.blendDstAlpha;
  return props;
}

/** Where a derived material records the surface state the draw hooks read per draw group. */
const BILLBOARD_KEY = 'godotBillboard';
const CASTS_SHADOW_KEY = 'godotCastsShadow';

/**
 * `billboard_mode`, shadow-pass membership, `alpha_hash_scale` and the AO values on `userData`,
 * not as material props: Godot decides the first three per surface, and here the draw hooks apply
 * them per draw group (`r3f/surfaceDrawHooks.ts`). The AO uniforms read theirs there at each
 * upload. A fresh object per bag, since the `.tres` loader writes its own keys into it.
 */
function surfaceUserData(scalars: StandardMaterial3DScalars): Record<string, unknown> {
  return {
    [BILLBOARD_KEY]: surfaceBillboard(scalars),
    [CASTS_SHADOW_KEY]: scalars.castsShadow,
    ...alphaHashScaleUserData(scalars.alphaHashScale),
    ...ambientOcclusionUserData(scalars.aoLightAffect, scalars.aoTextureChannelMask),
  };
}

/** A surface's billboard: `billboard_mode` and `billboard_keep_scale`. */
export interface SurfaceBillboard {
  readonly mode: number;
  readonly keepScale: boolean;
}

/** The billboard of Godot's default surface and of any material this derivation did not build. */
const NO_BILLBOARD: SurfaceBillboard = Object.freeze({
  mode: BillboardMode.BILLBOARD_DISABLED,
  keepScale: false,
});

/**
 * The modes `_update_shader` writes a billboard for (`material.cpp:1260-1335`). Any other
 * value draws as DISABLED, so it must not unbatch a GridMap item either.
 */
const BILLBOARDING_MODES: ReadonlySet<number> = new Set([
  BillboardMode.BILLBOARD_ENABLED,
  BillboardMode.BILLBOARD_FIXED_Y,
  BillboardMode.BILLBOARD_PARTICLES,
]);

/**
 * The billboard `scalars` describe, null being Godot's default surface. Built once per
 * bag, so the draw hooks read it every draw group without allocating.
 */
export function surfaceBillboard(scalars: StandardMaterial3DScalars | null): SurfaceBillboard {
  if (!scalars || !BILLBOARDING_MODES.has(scalars.billboardMode)) return NO_BILLBOARD;
  return { mode: scalars.billboardMode, keepScale: scalars.billboardKeepScale };
}

/** The billboard a material was derived with. */
export function billboardOf(material: THREE.Material): SurfaceBillboard {
  return recordedOn(material, BILLBOARD_KEY, NO_BILLBOARD);
}

/**
 * Whether a material's surface joins Godot's shadow pass. True for Godot's default
 * surface, which is opaque, and for any material this derivation did not build.
 */
export function castsShadowOf(material: THREE.Material): boolean {
  return recordedOn(material, CASTS_SHADOW_KEY, true);
}

/**
 * Derive the material this decoded StandardMaterial3D describes, in each pass a geometry
 * instance's fade can draw it in: unfaded, and the alpha pass.
 *
 * @param scalars - the decoded material, or null for a surface with none
 * @param textures - already-bound textures by Godot slot; an absent slot lands
 *   as `null`, never `undefined`, so a late arrival cannot be mistaken for
 *   "leave whatever the material has" by either adapter
 */
export function standardMaterialBags(
  scalars: StandardMaterial3DScalars | null,
  textures: ResolvedTextureSlots = {}
): FadeVariants<StandardMaterialBag> {
  const bag = scalars ? classBag(scalars, textures) : NO_MATERIAL;
  const source = scalars ?? NO_MATERIAL_ALPHA;
  const surface = {
    opacity: bag.props.opacity ?? 1,
    transparent: bag.props.transparent ?? false,
    depthWrite: bag.props.depthWrite ?? true,
    alphaPassDepthWrite: source.alphaPassDepthWrite,
    blending: bag.props.blending,
  };
  const { unfaded, alphaPass } = surfaceFadeVariants(source, surface);
  const prepass = scalars?.depthInAlphaPass === true;
  return {
    unfaded: withSurfaceAlpha(bag, unfaded, prepass ? DRAWN_OPAQUE_PREPASS : NO_OPAQUE_PREPASS),
    alphaPass: withSurfaceAlpha(bag, alphaPass, prepass ? FADED_OPAQUE_PREPASS : NO_OPAQUE_PREPASS),
  };
}

function withSurfaceAlpha(
  bag: StandardMaterialBag,
  { injection, ...alpha }: PassAlpha,
  prepass: OpaquePrepass
): StandardMaterialBag {
  const props = { ...bag.props, ...alpha };
  if (prepass.cutsDepth) props.userData = { ...bag.props.userData, ...opaquePrepassUserData(prepass) };
  const injections = [bag.injection, injection].filter((one) => one !== undefined);
  return { ...bag, props, injection: composeInjections(injections) };
}

/** The class `scalars` need, and its props. */
function classBag(scalars: StandardMaterial3DScalars, textures: ResolvedTextureSlots): StandardMaterialBag {
  const slot = (name: TextureSlot): THREE.Texture | null => textures[name] ?? null;
  const blend = materialBlendProps(scalars);
  // `fromArray` keeps the values linear. A hex would go through
  // `setHex(…, SRGBColorSpace)` and decode these already-linear channels a
  // second time, rendering everything too dark.
  const color = new THREE.Color().fromArray(scalars.color);

  // Godot SHADING_MODE_UNSHADED (0) outputs albedo unlit, as three's MeshBasicMaterial
  // does. Dropping emission is parity: Godot's unshaded branch writes
  // `frag_color = vec4(albedo, alpha)` and never reads the emission term.
  if (scalars.shadingMode === 'unshaded') {
    return {
      materialClass: 'basic',
      props: {
        color,
        vertexColors: scalars.useVertexColors,
        map: slot('albedo_texture'),
        transparent: scalars.transparent,
        opacity: scalars.opacity,
        alphaTest: scalars.alphaTest,
        alphaHash: scalars.alphaHash,
        depthWrite: scalars.depthWrite,
        depthTest: scalars.depthTest,
        side: scalars.side,
        userData: surfaceUserData(scalars),
        ...blend,
      },
    };
  }

  const emissiveMap = slot('emission_texture');
  const aoMap = slot('ao_texture');
  // Godot's `emission_operator` only becomes observable once a texture is in
  // play, and whether one resolved is knowable here and not at decode time.
  const emission = resolveEmission(scalars, scalars.emissionOperator, !!emissiveMap);
  const pbr: THREE.MeshStandardMaterialParameters = {
    color,
    vertexColors: scalars.useVertexColors,
    metalness: scalars.metalness,
    roughness: scalars.roughness,
    transparent: scalars.transparent,
    opacity: scalars.opacity,
    alphaTest: scalars.alphaTest,
    alphaHash: scalars.alphaHash,
    depthWrite: scalars.depthWrite,
    depthTest: scalars.depthTest,
    side: scalars.side,
    map: slot('albedo_texture'),
    normalMap: slot('normal_texture'),
    normalScale: new THREE.Vector2(scalars.normalScale.x, scalars.normalScale.y),
    roughnessMap: slot('roughness_texture'),
    metalnessMap: slot('metallic_texture'),
    emissiveMap,
    aoMap,
    // Field by field, not spread: `scalars` is far wider than `EmissionScalars`, and a
    // pass-through in `resolveEmission` would splat every scalar onto the material.
    emissive: new THREE.Color().fromArray(emission.emissive),
    emissiveIntensity: emission.emissiveIntensity,
    // Godot heightmap → three vertex displacement, a parity limitation: Godot uses
    // texture-space parallax, and three moves vertices, so it needs a subdivided mesh
    // and its depth is in world units. Inert without a heightmap (scale 0, no map).
    displacementMap: slot('heightmap_texture'),
    displacementScale: scalars.heightmapScale,
    userData: surfaceUserData(scalars),
    ...blend,
  };

  // Godot's AO sampler is `hint_default_white` (`material.cpp:1128`), so a surface with no map
  // occludes nothing.
  const injection = aoMap ? GODOT_AMBIENT_OCCLUSION : undefined;
  if (!needsPhysicalMaterial(scalars)) return { materialClass: 'standard', props: pbr, injection };
  return {
    materialClass: 'physical',
    injection,
    props: {
      ...pbr,
      clearcoat: scalars.clearcoat,
      clearcoatRoughness: scalars.clearcoatRoughness,
      sheen: scalars.rim,
      sheenColor: rimSheenColor(scalars),
      sheenRoughness: RIM_SHEEN_ROUGHNESS,
      anisotropy: scalars.anisotropy,
      anisotropyRotation: scalars.anisotropyRotation,
      // The flowmap needs an alpha→blue repack before it means anything, so
      // only an adapter that can do one ever fills this slot.
      anisotropyMap: slot('anisotropy_flowmap'),
      transmission: scalars.transmission,
      thickness: scalars.refractionThickness,
    },
  };
}
