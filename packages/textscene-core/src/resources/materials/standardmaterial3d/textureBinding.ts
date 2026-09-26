/**
 * Binding a texture to a StandardMaterial3D slot, the one place that knows what a Godot
 * slot needs of its texture: its colour space, and when a shared cache entry must clone.
 * `<StandardMaterialSlot>` and `build.ts` both cross it. It value-imports `three`, so
 * `index.ts` never reaches it (ADR-0031).
 */

import * as THREE from 'three';
import {
  applyTextureState,
  isMaterialOwnedTexture,
  type MaterialTextureState,
} from '../../textures/applyTextureState';
import { GODOT_TEXTURE_FILTER_DEFAULT } from '../../textures/godotTextureFilter';
import type { StandardMaterial3DScalars, TextureSlot } from './types';

/**
 * The colour space each slot's sampler reads in: a property of the slot, never the image, so it
 * overrides the loader's tag. Only `source_color` samplers read sRGB: albedo (`scene/resources/material.cpp:969`),
 * emission (:1066) and detail albedo (:1137). Exhaustive, so a new slot fails to compile until someone
 * reads Godot's shader. `textureBinding.md` has the shader chain and every sampler.
 */
const SLOT_COLOR_SPACE: Readonly<Record<TextureSlot, THREE.ColorSpace>> = {
  albedo_texture: THREE.SRGBColorSpace,
  emission_texture: THREE.SRGBColorSpace,
  normal_texture: THREE.NoColorSpace,
  roughness_texture: THREE.NoColorSpace,
  metallic_texture: THREE.NoColorSpace,
  ao_texture: THREE.NoColorSpace,
  heightmap_texture: THREE.NoColorSpace,
  anisotropy_flowmap: THREE.NoColorSpace,
};

/**
 * The per-material half of a binding, which a caller can adjust apart from the per-slot
 * decision, as a triplanar material folds the mesh size into the tiling scale. Only an
 * authored filter passes: comparing against Godot's default would clone every texture
 * whose sampler state differs from it.
 */
export function materialTextureState(
  scalars: StandardMaterial3DScalars
): MaterialTextureState {
  return {
    uv: { scale: scalars.uv1Scale, offset: scalars.uv1Offset },
    filter:
      scalars.textureFilter === GODOT_TEXTURE_FILTER_DEFAULT ? undefined : scalars.textureFilter,
    repeat: scalars.textureRepeat,
  };
}

/**
 * The texture this slot must sample: the original when it carries everything the
 * binding needs, otherwise one clone that does, marked so `releaseBoundTexture` frees it.
 */
export function bindSlotTexture(
  texture: THREE.Texture,
  slot: TextureSlot,
  material: MaterialTextureState
): THREE.Texture {
  return applyTextureState(texture, { ...material, colorSpace: SLOT_COLOR_SPACE[slot] });
}

/**
 * Release a texture a binding produced: a dispose on a clone this module made, and a
 * no-op on a shared cache entry, which the loader owns. Symmetric with `bindSlotTexture`,
 * so a caller never learns how ownership is recorded.
 */
export function releaseBoundTexture(texture: THREE.Texture | null | undefined): void {
  if (texture && isMaterialOwnedTexture(texture)) texture.dispose();
}

/**
 * Release every texture a binding produced for this material. It leaves the
 * material itself, and any procedural pin it holds, to the caller.
 */
export function releaseOwnedTextures(material: THREE.Material): void {
  // Walk the material's own values rather than a hand-listed set of slot names:
  // three assigns every map in its constructor, so this cannot go stale the day
  // a new one is wired, and the ownership tag is the real discriminator anyway.
  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) releaseBoundTexture(value);
  }
}
