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
import { fadedSurfaceAlpha } from '../../../r3f/materials/fadedSurfaceAlpha';
import type { ProgramInjection } from '../../../r3f/materialProgramInputs';
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
 * `injection` is the fragment-alpha patch the surface needs, which each adapter installs.
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
 * `billboard_mode` and shadow-pass membership on `userData`, not as material props:
 * Godot decides both per surface, in the vertex shader and in the render list, and here
 * the draw hooks apply both per draw group (`r3f/surfaceDrawHooks.ts`). A fresh object
 * per bag, since the `.tres` loader writes its own keys into it.
 */
function surfaceUserData(scalars: StandardMaterial3DScalars): Record<string, unknown> {
  return {
    [BILLBOARD_KEY]: surfaceBillboard(scalars),
    [CASTS_SHADOW_KEY]: scalars.castsShadow,
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
  const billboard = material.userData[BILLBOARD_KEY] as SurfaceBillboard | undefined;
  return billboard ?? NO_BILLBOARD;
}

/**
 * Whether a material's surface joins Godot's shadow pass. True for Godot's default
 * surface, which is opaque, and for any material this derivation did not build.
 */
export function castsShadowOf(material: THREE.Material): boolean {
  return material.userData[CASTS_SHADOW_KEY] !== false;
}

/**
 * Derive the material this decoded StandardMaterial3D describes, drawn by a geometry instance.
 *
 * @param scalars - the decoded material, or null for a surface with none
 * @param textures - already-bound textures by Godot slot; an absent slot lands
 *   as `null`, never `undefined`, so a late arrival cannot be mistaken for
 *   "leave whatever the material has" by either adapter
 * @param fade - the drawing GeometryInstance3D's fade (`geometryFade`); 1 for any other drawer
 */
export function standardMaterialBag(
  scalars: StandardMaterial3DScalars | null,
  textures: ResolvedTextureSlots = {},
  fade = 1
): StandardMaterialBag {
  const bag = scalars ? classBag(scalars, textures) : NO_MATERIAL;
  const source = scalars ?? NO_MATERIAL_ALPHA;
  const surface = {
    opacity: bag.props.opacity ?? 1,
    transparent: bag.props.transparent ?? false,
    depthWrite: bag.props.depthWrite ?? true,
    alphaPassDepthWrite: source.alphaPassDepthWrite,
    blending: bag.props.blending,
  };
  const { injection, ...alpha } = fadedSurfaceAlpha(source, surface, fade);
  return { ...bag, props: { ...bag.props, ...alpha }, injection };
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
        depthWrite: scalars.depthWrite,
        depthTest: scalars.depthTest,
        side: scalars.side,
        userData: surfaceUserData(scalars),
        ...blend,
      },
    };
  }

  const emissiveMap = slot('emission_texture');
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
    depthWrite: scalars.depthWrite,
    depthTest: scalars.depthTest,
    side: scalars.side,
    map: slot('albedo_texture'),
    normalMap: slot('normal_texture'),
    normalScale: new THREE.Vector2(scalars.normalScale.x, scalars.normalScale.y),
    roughnessMap: slot('roughness_texture'),
    metalnessMap: slot('metallic_texture'),
    emissiveMap,
    aoMap: slot('ao_texture'),
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

  if (!needsPhysicalMaterial(scalars)) return { materialClass: 'standard', props: pbr };
  return {
    materialClass: 'physical',
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
