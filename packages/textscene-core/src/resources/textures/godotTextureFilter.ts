/**
 * Godot's `BaseMaterial3D.texture_filter` to three.js sampler state. Not a
 * resource slice (ADR-0031): a parity table and its appliers, shared by every
 * material slice's renderer, which decodes the ordinal and passes it here.
 */

import * as THREE from 'three';
import { BASE_MATERIAL_3D_DEFAULTS } from '../../godot/scene/baseMaterial3D';

/**
 * Godot's anisotropy ceiling is `1 << anisotropic_filtering_level`, a project
 * setting whose default is level 2 (4x). Pinned at 16 (level 4), not plumbed:
 * three clamps to the GPU maximum at upload, so this is a ceiling, never an error.
 */
const GODOT_ANISOTROPY_MAX = 16;

interface TextureFilterState {
  magFilter: THREE.MagnificationTextureFilter;
  minFilter: THREE.MinificationTextureFilter;
  generateMipmaps: boolean;
  anisotropy: number;
}

/**
 * One sampler per mode, as `MaterialStorage::samplers_rd_allocate` allocates.
 * Godot's `min_filter` is the within-level filter and `mip_filter` the
 * between-level one, and three fuses both into `minFilter`. Rows 0 and 1 set
 * `max_lod = 0`, so no mipmaps.
 */
const STATES: Record<number, TextureFilterState> = {
  // NEAREST
  0: {
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter,
    generateMipmaps: false,
    anisotropy: 1,
  },
  // LINEAR
  1: {
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
    generateMipmaps: false,
    anisotropy: 1,
  },
  // NEAREST_WITH_MIPMAPS. The mip filter for rows 2-5 is linear unless the project
  // sets `rendering/textures/default_filters/use_nearest_mipmap_filter`.
  2: {
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestMipmapLinearFilter,
    generateMipmaps: true,
    anisotropy: 1,
  },
  // LINEAR_WITH_MIPMAPS, Godot's default and also three's default state, so an
  // unauthored `texture_filter` changes nothing.
  3: {
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearMipmapLinearFilter,
    generateMipmaps: true,
    anisotropy: 1,
  },
  // NEAREST_WITH_MIPMAPS_ANISOTROPIC. three skips anisotropy when `magFilter` is
  // `NearestFilter`, so the texture gets the property but not the sampling.
  // Godot applies it.
  4: {
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestMipmapLinearFilter,
    generateMipmaps: true,
    anisotropy: GODOT_ANISOTROPY_MAX,
  },
  // LINEAR_WITH_MIPMAPS_ANISOTROPIC
  5: {
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearMipmapLinearFilter,
    generateMipmaps: true,
    anisotropy: GODOT_ANISOTROPY_MAX,
  },
};

/**
 * The sampler state for a `texture_filter` ordinal. An absent or out-of-range
 * value resolves to Godot's default, matching how the engine treats anything
 * outside `TEXTURE_FILTER_MAX`.
 */
export function godotTextureFilterState(filter: number | undefined): TextureFilterState {
  const defaultFilter = BASE_MATERIAL_3D_DEFAULTS.textureFilter;
  return STATES[filter ?? defaultFilter] ?? STATES[defaultFilter]!;
}

/** The state as it lands on THIS texture, once its own mip availability is honoured. */
function effectiveState(texture: THREE.Texture, state: TextureFilterState): TextureFilterState {
  if (!state.generateMipmaps || texture.generateMipmaps) return state;
  return {
    ...state,
    minFilter: WITHOUT_MIPMAPS[state.minFilter] ?? state.minFilter,
    generateMipmaps: false,
  };
}

/** Whether a texture already samples the way this state asks, so no clone is needed. */
export function textureFilterMatches(texture: THREE.Texture, state: TextureFilterState): boolean {
  const wanted = effectiveState(texture, state);
  return (
    texture.magFilter === wanted.magFilter &&
    texture.minFilter === wanted.minFilter &&
    texture.generateMipmaps === wanted.generateMipmaps &&
    texture.anisotropy === wanted.anisotropy
  );
}

/** The mip-free equivalent of a minification filter, for a texture with no mip chain. */
const WITHOUT_MIPMAPS: Partial<Record<THREE.MinificationTextureFilter, THREE.MinificationTextureFilter>> = {
  [THREE.NearestMipmapLinearFilter]: THREE.NearestFilter,
  [THREE.NearestMipmapNearestFilter]: THREE.NearestFilter,
  [THREE.LinearMipmapLinearFilter]: THREE.LinearFilter,
  [THREE.LinearMipmapNearestFilter]: THREE.LinearFilter,
};

/** Marks a texture imported without a mip chain. In `userData`, so every `clone()` carries it. */
const HAS_NO_MIP_CHAIN = 'textsceneHasNoMipChain';

/**
 * Removes the mip chain of a texture the caller owns, for an image Godot imports without one, and
 * marks it, so a clone whose sampler the glTF loader rewrites can drop it again.
 */
export function dropMipChain(texture: THREE.Texture): void {
  texture.generateMipmaps = false;
  texture.minFilter = WITHOUT_MIPMAPS[texture.minFilter] ?? texture.minFilter;
  texture.userData[HAS_NO_MIP_CHAIN] = true;
}

/** Whether `dropMipChain` removed the mip chain of `texture`, or of the texture it is cloned from. */
export function hasDroppedMipChain(texture: THREE.Texture): boolean {
  return texture.userData[HAS_NO_MIP_CHAIN] === true;
}

/**
 * Writes the sampler state onto a texture the caller owns. A `*_WITH_MIPMAPS`
 * filter creates no mip chain: a procedural texture never calls `generate_mipmaps`
 * (`scene/resources/gradient_texture.cpp`), so Godot samples the base level only.
 */
export function applyTextureFilterState(texture: THREE.Texture, state: TextureFilterState): void {
  const wanted = effectiveState(texture, state);
  texture.magFilter = wanted.magFilter;
  texture.minFilter = wanted.minFilter;
  texture.generateMipmaps = wanted.generateMipmaps;
  texture.anisotropy = wanted.anisotropy;
}
