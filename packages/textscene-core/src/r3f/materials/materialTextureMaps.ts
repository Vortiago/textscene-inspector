/**
 * The three-side map props one Godot material contributes, and the single place
 * the two texture vocabularies are paired.
 *
 * Spelled with three's own map names because that is what a node component
 * resolves and hands over, while the derivation is addressed by Godot SLOT
 * (`albedo_texture`, `heightmap_texture`, …). Somebody has to pair them, and
 * pairing them twice is how a map comes to land in the right slot on one arrival
 * and the wrong one on another — the failure is a texture appearing as roughness
 * on a `.tres` material and as metalness on an inline one, with no type error.
 *
 * Every texture here must arrive ALREADY BOUND — put through `bindSlotTexture`
 * for its Godot slot by whoever resolved it. See
 * `resources/materials/standardmaterial3d/textureBinding.ts`.
 */

import type * as THREE from 'three';
import type { ResolvedTextureSlots } from '../../resources/materials/standardmaterial3d/types';

export interface MaterialTextureMaps {
  albedoMap?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  metalnessMap?: THREE.Texture;
  emissiveMap?: THREE.Texture;
  aoMap?: THREE.Texture;
  /** Godot `heightmap_texture` → three.js displacementMap (height mapping). */
  displacementMap?: THREE.Texture;
  /** Godot `anisotropy_flowmap` → three.js anisotropyMap (flowmap). */
  anisotropyMap?: THREE.Texture;
}

/** The resolved maps keyed by the Godot slot each one came from. */
export function textureSlotsFromMaps(maps: MaterialTextureMaps): ResolvedTextureSlots {
  return {
    albedo_texture: maps.albedoMap ?? null,
    normal_texture: maps.normalMap ?? null,
    roughness_texture: maps.roughnessMap ?? null,
    metallic_texture: maps.metalnessMap ?? null,
    emission_texture: maps.emissiveMap ?? null,
    ao_texture: maps.aoMap ?? null,
    heightmap_texture: maps.displacementMap ?? null,
    anisotropy_flowmap: maps.anisotropyMap ?? null,
  };
}
