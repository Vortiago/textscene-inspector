/**
 * The three-side map props one Godot material contributes, and the one place
 * three's map names are paired with Godot slots. Pairing them twice lets a map
 * land as roughness on one arrival and metalness on another. Every texture arrives
 * bound through `bindSlotTexture` (`resources/materials/standardmaterial3d/textureBinding.ts`).
 */

import type * as THREE from 'three';
import type { ResolvedTextures } from '../../resources/materials/standardmaterial3d/types';
import type { UVTransform } from '../../resources/textures/applyTextureState';

export interface MaterialTextureMaps {
  albedoMap?: THREE.Texture;
  normalMap?: THREE.Texture;
  roughnessMap?: THREE.Texture;
  metalnessMap?: THREE.Texture;
  emissiveMap?: THREE.Texture;
  aoMap?: THREE.Texture;
  /** Godot `heightmap_texture`, which the parallax samples through `bindHeightmap`. */
  heightMap?: THREE.Texture;
  /** Godot `anisotropy_flowmap` → three.js anisotropyMap (flowmap). */
  anisotropyMap?: THREE.Texture;
  /** The UV transform a render-target `albedoMap` samples through, which the target cannot carry. */
  albedoTargetUv?: UVTransform;
}

/** The resolved maps keyed by the Godot slot each one came from, with a render-target albedo's UV. */
export function textureSlotsFromMaps(maps: MaterialTextureMaps): ResolvedTextures {
  return {
    albedoTargetUv: maps.albedoTargetUv,
    albedo_texture: maps.albedoMap ?? null,
    normal_texture: maps.normalMap ?? null,
    roughness_texture: maps.roughnessMap ?? null,
    metallic_texture: maps.metalnessMap ?? null,
    emission_texture: maps.emissiveMap ?? null,
    ao_texture: maps.aoMap ?? null,
    heightmap_texture: maps.heightMap ?? null,
    anisotropy_flowmap: maps.anisotropyMap ?? null,
  };
}
