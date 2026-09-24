/**
 * The imperative adapter over the one StandardMaterial3D derivation (`materialBag.ts`),
 * for the material the resource pipeline caches. `<StandardMaterialSlot>` is the reactive
 * one R3F prop-diffs, and neither decodes nor derives anything of its own (ADR-0031). It
 * value-imports `three`, so `index.ts` never imports it.
 */

import * as THREE from 'three';
import { info } from '../../../logger';
import { standardMaterialBag, type StandardMaterialBag } from './materialBag';
import { bindSlotTexture, materialTextureState } from './textureBinding';
import type { ResolvedTextureSlots, StandardMaterial3DScalars, TextureSlot } from './types';

/**
 * Build the material a decoded StandardMaterial3D describes, or Godot's default 3D
 * surface for `null`, as the reactive adapter does. Textures bind here, not at load:
 * Godot's per-slot sampling state lives on the `THREE.Texture` in three, which the
 * loader caches per path (`textureBinding.ts`).
 */
export function buildStandardMaterial(
  scalars: StandardMaterial3DScalars | null,
  textures: ResolvedTextureSlots = {}
): THREE.Material {
  return materialFromBag(standardMaterialBag(scalars, scalars ? boundTextures(scalars, textures) : {}));
}

/**
 * A derived bag's material class as a constructed `THREE.Material`, for a caller that
 * already holds bound textures, such as the GLB surface-material override.
 * `<StandardMaterialSlot>` maps the same classes onto JSX tags (ADR-0039).
 */
export function materialFromBag(bag: StandardMaterialBag): THREE.Material {
  switch (bag.materialClass) {
    case 'basic':
      return new THREE.MeshBasicMaterial(bag.props);
    case 'physical':
      return new THREE.MeshPhysicalMaterial(bag.props);
    default:
      return new THREE.MeshStandardMaterial(bag.props);
  }
}

/** Each populated slot's texture put through this material's own binding. */
function boundTextures(
  scalars: StandardMaterial3DScalars,
  textures: ResolvedTextureSlots
): ResolvedTextureSlots {
  const state = materialTextureState(scalars);
  const bound: ResolvedTextureSlots = {};
  for (const slot of Object.keys(textures) as TextureSlot[]) {
    const texture = textures[slot];
    if (!texture) continue;
    const applied = bindSlotTexture(texture, slot, state);
    if (applied !== texture) {
      info(
        `[StandardMaterial3D] Cloned ${slot} for uv1_scale=${scalars.uv1Scale.x},${scalars.uv1Scale.y} ` +
          `texture_filter=${scalars.textureFilter} texture_repeat=${scalars.textureRepeat} ` +
          `colorSpace=${applied.colorSpace || 'none'}`
      );
    }
    bound[slot] = applied;
  }
  return bound;
}
