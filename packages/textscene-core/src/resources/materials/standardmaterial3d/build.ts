/**
 * The IMPERATIVE adapter over the one StandardMaterial3D derivation: scalars
 * plus already-resolved textures in, a `THREE.Material` out. It maps
 * `standardMaterialBag`'s class to a three constructor and binds the textures on
 * the way in; it derives no prop of its own.
 *
 * `<StandardMaterialSlot>` is the reactive adapter over the SAME derivation —
 * R3F needs a JSX element so it can prop-diff a material across re-renders, and
 * the resource pipeline needs a plain object it can cache and hand to
 * `<primitive>`. Neither may decode anything of its own (ADR-0031), and neither
 * may derive anything of its own (`materialBag.ts`).
 *
 * Never imported by `index.ts`: this module value-imports `three`.
 */

import * as THREE from 'three';
import { info } from '../../../logger';
import { standardMaterialBag } from './materialBag';
import { bindSlotTexture, materialTextureState } from './textureBinding';
import type { ResolvedTextureSlots, StandardMaterial3DScalars, TextureSlot } from './types';

/**
 * Build the material this decoded StandardMaterial3D describes.
 *
 * `null` is the derivation's "no material" input — Godot's default 3D surface
 * rather than a default-constructed StandardMaterial3D — and is accepted here
 * because the reactive adapter accepts it: an adapter narrower than the
 * derivation it wraps forces its callers to reinvent the case it dropped.
 *
 * Textures are bound here rather than at load: what a slot needs of the texture
 * it samples is per-material and per-slot in Godot but lives on the
 * `THREE.Texture` in three, and the loader caches one texture per path — see
 * `textureBinding.ts` for the rule and for why that means cloning.
 */
export function buildStandardMaterial(
  scalars: StandardMaterial3DScalars | null,
  textures: ResolvedTextureSlots = {}
): THREE.Material {
  const bag = standardMaterialBag(scalars, scalars ? boundTextures(scalars, textures) : {});
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
