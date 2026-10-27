/**
 * A material as a caller drives the adapters: each texture bound to its slot with the material's
 * own state, derived into bags, and the unfaded bag constructed as a `THREE.Material`.
 * `useSurfaceMaterial` does the same with the maps it resolves.
 */
import type * as THREE from 'three';
import { materialFromBag } from './build';
import { standardMaterialBags } from './materialBag';
import { materialTextureStates } from './textureBinding';
import { bindSlotTexture } from './textureBinding.testkit';
import { DEFAULT_ANISOTROPIC_FILTERING_LEVEL } from '../../../godot/scene/viewport.js';
import type { ResolvedTextureSlots, StandardMaterial3DScalars, TextureSlot } from './types';

/** Each populated slot's texture put through the material's own binding. */
function boundTextureSlots(
  scalars: StandardMaterial3DScalars,
  textures: ResolvedTextureSlots
): ResolvedTextureSlots {
  const states = materialTextureStates(scalars, DEFAULT_ANISOTROPIC_FILTERING_LEVEL);
  const bound: ResolvedTextureSlots = {};
  for (const slot of Object.keys(textures) as TextureSlot[]) {
    const texture = textures[slot];
    if (texture) bound[slot] = bindSlotTexture(texture, slot, states);
  }
  return bound;
}

/** The material `scalars` describe with `textures` bound, or Godot's default surface for null. */
export function buildMaterial(
  scalars: StandardMaterial3DScalars | null,
  textures: ResolvedTextureSlots = {}
): THREE.Material {
  return materialFromBag(
    standardMaterialBags(scalars, scalars ? boundTextureSlots(scalars, textures) : {}).unfaded
  );
}
