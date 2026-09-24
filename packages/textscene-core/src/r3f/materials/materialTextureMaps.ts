/**
 * The three-side map props one Godot material contributes, and the one place
 * three's map names are paired with Godot slots. Pairing them twice lets a map
 * land as roughness on one arrival and metalness on another. Every texture arrives
 * bound through `bindSlotTexture` (`resources/materials/standardmaterial3d/textureBinding.ts`).
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
