/**
 * The imperative adapter over the one decode: scalars plus already-resolved
 * textures in, a `THREE.Material` out.
 *
 * `<StandardMaterialSlot>` is the reactive adapter over the SAME
 * `StandardMaterial3DScalars` — R3F needs a JSX element so it can prop-diff a
 * material across re-renders, and the resource pipeline needs a plain object it
 * can cache and hand to `<primitive>`. Neither may decode anything of its own
 * (ADR-0031), and the pieces where "same state" is non-obvious — which material
 * CLASS a feature set needs, how `rim_tint` becomes a sheen colour — live here
 * so both read one definition.
 *
 * Never imported by `index.ts`: this module value-imports `three`.
 */

import * as THREE from 'three';
import { info } from '../../../logger';
import { applyTextureState, type TextureState } from '../../textures/applyTextureState';
import { GODOT_TEXTURE_FILTER_DEFAULT } from '../../textures/godotTextureFilter';
import { resolveEmission } from './emission';
import type { MaterialBlendState, StandardMaterial3DScalars, TextureSlot } from './types';

/** A resolved texture per slot; absent or null means "nothing in that slot". */
export type ResolvedTextureSlots = Partial<Record<TextureSlot, THREE.Texture | null>>;

/**
 * The slots this builder can actually apply.
 *
 * `anisotropy_flowmap` is absent on purpose: Godot stores the per-pixel
 * anisotropy STRENGTH in the alpha channel and three reads it from blue, so the
 * image needs a channel repack before it means anything. That repack is a canvas
 * readback living in the shared applier layer (`resources/textures/repackFlowmap.ts`),
 * which this layer must not import — so an external material's flowmap is not
 * fetched at all rather than sampled wrongly. Its anisotropy SCALARS still
 * apply, which is already the whole effect for a flowmap-less material.
 */
export const APPLIED_TEXTURE_SLOTS: readonly TextureSlot[] = [
  'albedo_texture',
  'normal_texture',
  'roughness_texture',
  'metallic_texture',
  'emission_texture',
  'ao_texture',
  'heightmap_texture',
];

/**
 * A StandardMaterial3D upgrades from `MeshStandardMaterial` to
 * `MeshPhysicalMaterial` when any physical-only feature is active: clearcoat
 * (FEATURE_CLEARCOAT), rim → sheen (FEATURE_RIM), anisotropy
 * (FEATURE_ANISOTROPY), or refraction → transmission (FEATURE_REFRACTION).
 * Declared once so a new physical-only flag extends exactly this set rather than
 * an inline OR chain in each adapter that a future addition could forget.
 */
export function needsPhysicalMaterial(scalars: StandardMaterial3DScalars): boolean {
  return (
    scalars.clearcoat > 0 ||
    scalars.rim > 0 ||
    scalars.anisotropy > 0 ||
    scalars.transmission > 0
  );
}

/**
 * `rim_tint` blends the rim highlight from the light colour (0) toward the
 * albedo (1); three's closest native term is `sheenColor`.
 */
export function rimSheenColor(scalars: StandardMaterial3DScalars): THREE.Color {
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
export const RIM_SHEEN_ROUGHNESS = 0.1;

/**
 * The blending fields to hand a material, with the factor fields OMITTED where
 * the mode resolves to a three preset that already carries them.
 *
 * Omitted rather than `undefined`: `Material.setValues` warns on an undefined
 * parameter, and R3F assigns whatever it is given, so an explicit `undefined`
 * would clobber three's own blending state instead of leaving it alone.
 */
export function materialBlendProps(scalars: StandardMaterial3DScalars): MaterialBlendState {
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

/**
 * The per-material texture state (`uv1_scale` / `uv1_offset`, `texture_filter`,
 * `texture_repeat`) every slot on this material samples with.
 *
 * Only an AUTHORED filter is passed: comparing an unauthored material against
 * Godot's default would clone every texture whose sampler state merely differs
 * from it, re-uploading per material per slot for a filter nobody asked for.
 */
export function materialTextureState(scalars: StandardMaterial3DScalars): TextureState {
  return {
    uv: { scale: scalars.uv1Scale, offset: scalars.uv1Offset },
    filter:
      scalars.textureFilter === GODOT_TEXTURE_FILTER_DEFAULT ? undefined : scalars.textureFilter,
    repeat: scalars.textureRepeat,
  };
}

/**
 * Build the material this decoded StandardMaterial3D describes.
 *
 * Texture state is applied here rather than at load: it is per-material in Godot
 * but lives on the `THREE.Texture` in three, and the loader caches one texture
 * per path — see `applyTextureState` for why that means cloning.
 */
export function buildStandardMaterial(
  scalars: StandardMaterial3DScalars,
  textures: ResolvedTextureSlots = {}
): THREE.Material {
  const state = materialTextureState(scalars);
  const slotTexture = (slot: TextureSlot): THREE.Texture | null => {
    const texture = textures[slot];
    if (!texture) return null;
    const applied = applyTextureState(texture, state);
    if (applied !== texture) {
      info(
        `[StandardMaterial3D] Cloned ${slot} for uv1_scale=${scalars.uv1Scale.x},${scalars.uv1Scale.y} ` +
          `texture_filter=${scalars.textureFilter} texture_repeat=${scalars.textureRepeat}`
      );
    }
    return applied;
  };

  const albedoMap = slotTexture('albedo_texture');
  const blend = materialBlendProps(scalars);

  // Godot SHADING_MODE_UNSHADED (0): albedo is output directly, unaffected by
  // lights. three's MeshBasicMaterial is the unlit equivalent, so no PBR slot
  // applies. Dropping EMISSION here is PARITY, not an omission: Godot's
  // unshaded branch writes `frag_color = vec4(albedo, alpha)` and never reads
  // the emission term it computed.
  if (scalars.shadingMode === 'unshaded') {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color().fromArray(scalars.color),
      vertexColors: scalars.useVertexColors,
      map: albedoMap,
      transparent: scalars.transparent,
      opacity: scalars.opacity,
      alphaTest: scalars.alphaTest,
      depthWrite: scalars.depthWrite,
      depthTest: scalars.depthTest,
      side: scalars.side,
      ...blend,
    });
  }

  const emissiveMap = slotTexture('emission_texture');
  // Godot's `emission_operator` only becomes observable once a texture is in
  // play, and whether one resolved is knowable here and not at decode time.
  const emission = resolveEmission(scalars, scalars.emissionOperator, !!emissiveMap);
  const pbr = {
    // `fromArray` keeps the values LINEAR. A hex would go through
    // `setHex(…, SRGBColorSpace)` and decode these already-linear channels a
    // second time, rendering everything too dark.
    color: new THREE.Color().fromArray(scalars.color),
    vertexColors: scalars.useVertexColors,
    metalness: scalars.metalness,
    roughness: scalars.roughness,
    transparent: scalars.transparent,
    opacity: scalars.opacity,
    alphaTest: scalars.alphaTest,
    depthWrite: scalars.depthWrite,
    depthTest: scalars.depthTest,
    side: scalars.side,
    map: albedoMap,
    normalMap: slotTexture('normal_texture'),
    normalScale: new THREE.Vector2(scalars.normalScale.x, scalars.normalScale.y),
    roughnessMap: slotTexture('roughness_texture'),
    metalnessMap: slotTexture('metallic_texture'),
    emissiveMap,
    aoMap: slotTexture('ao_texture'),
    emissive: new THREE.Color().fromArray(emission.emissive),
    emissiveIntensity: emission.emissiveIntensity,
    // Godot heightmap (FEATURE_HEIGHT_MAPPING) → three vertex displacement.
    // PARITY LIMITATION: Godot uses texture-space parallax; three moves real
    // vertices, so it needs a subdivided mesh and its depth is in world units.
    // Inert for a non-heightmap material (scale 0, no map).
    displacementMap: slotTexture('heightmap_texture'),
    displacementScale: scalars.heightmapScale,
    ...blend,
  };

  if (needsPhysicalMaterial(scalars)) {
    return new THREE.MeshPhysicalMaterial({
      ...pbr,
      clearcoat: scalars.clearcoat,
      clearcoatRoughness: scalars.clearcoatRoughness,
      sheen: scalars.rim,
      sheenColor: rimSheenColor(scalars),
      sheenRoughness: RIM_SHEEN_ROUGHNESS,
      anisotropy: scalars.anisotropy,
      anisotropyRotation: scalars.anisotropyRotation,
      transmission: scalars.transmission,
      thickness: scalars.refractionThickness,
    });
  }
  return new THREE.MeshStandardMaterial(pbr);
}
