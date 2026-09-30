/**
 * The imperative adapter as a caller drives it: each texture bound to its slot with the
 * material's own state, then the derived bag constructed as a `THREE.Material`, as the GLB
 * surface-material override does with the maps `useMaterialTextures` binds.
 */
import type * as THREE from 'three';
import { materialFromBag } from './build';
import { standardMaterialBag } from './materialBag';
import { bindSlotTexture, materialTextureState } from './textureBinding';
import type { ResolvedTextureSlots, StandardMaterial3DScalars, TextureSlot } from './types';

/** Each populated slot's texture put through the material's own binding. */
export function boundTextureSlots(
  scalars: StandardMaterial3DScalars,
  textures: ResolvedTextureSlots
): ResolvedTextureSlots {
  const state = materialTextureState(scalars);
  const bound: ResolvedTextureSlots = {};
  for (const slot of Object.keys(textures) as TextureSlot[]) {
    const texture = textures[slot];
    if (texture) bound[slot] = bindSlotTexture(texture, slot, state);
  }
  return bound;
}

/** The material `scalars` describe with `textures` bound, or Godot's default surface for null. */
export function buildMaterial(
  scalars: StandardMaterial3DScalars | null,
  textures: ResolvedTextureSlots = {}
): THREE.Material {
  return materialFromBag(standardMaterialBag(scalars, scalars ? boundTextureSlots(scalars, textures) : {}));
}
