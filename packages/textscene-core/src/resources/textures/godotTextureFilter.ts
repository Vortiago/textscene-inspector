/**
 * Godot's `BaseMaterial3D.texture_filter` → three.js sampler state.
 *
 * NOT A RESOURCE SLICE (ADR-0031): a parity TABLE plus the appliers over it,
 * shared by every material slice's renderer. It claims no type name and decodes
 * no serialization — the material slices decode the ordinal and pass it here.
 *
 * Godot allocates one sampler per filter mode in
 * `MaterialStorage::samplers_rd_allocate`. Its `min_filter` there is the
 * WITHIN-level filter and `mip_filter` the BETWEEN-level one; three fuses both
 * into a single `minFilter`, which is the only non-obvious step in the mapping:
 *
 *   | Godot                              | magFilter | minFilter                 | mips | aniso |
 *   | 0 NEAREST                          | Nearest   | Nearest                   | no   |  1    |
 *   | 1 LINEAR                           | Linear    | Linear                    | no   |  1    |
 *   | 2 NEAREST_WITH_MIPMAPS             | Nearest   | NearestMipmapLinear       | yes  |  1    |
 *   | 3 LINEAR_WITH_MIPMAPS  (default)   | Linear    | LinearMipmapLinear        | yes  |  1    |
 *   | 4 NEAREST_..._ANISOTROPIC          | Nearest   | NearestMipmapLinear       | yes  | 16    |
 *   | 5 LINEAR_..._ANISOTROPIC           | Linear    | LinearMipmapLinear        | yes  | 16    |
 *
 * Rows 0 and 1 set `max_lod = 0` in Godot, i.e. mipmapping off entirely. The
 * mip filter for rows 2-5 is LINEAR unless the project sets
 * `rendering/textures/default_filters/use_nearest_mipmap_filter`, which no
 * project in this corpus does.
 *
 * ROW 3 IS ALSO THREE'S OWN DEFAULT STATE, which is why honouring this property
 * changes nothing for a material that does not author it.
 *
 * CAVEAT worth knowing before trusting row 4: three skips anisotropy entirely
 * when `magFilter` is `NearestFilter`, so a nearest-sampled texture gets the
 * property but not the sampling. Godot does apply it. One corpus material sits
 * there, and it is pixel art, where anisotropy is close to meaningless anyway.
 *
 * THIS ENUM IS `BaseMaterial3D::TextureFilter` (shared verbatim by
 * `SpriteBase3D`). `CanvasItem.texture_filter` is a DIFFERENT enum whose 0 means
 * "inherit from parent node", not NEAREST — do not reuse this mapping for 2D
 * nodes without resolving that inheritance first.
 */

import * as THREE from 'three';

/** `BaseMaterial3D::texture_filter = TEXTURE_FILTER_LINEAR_WITH_MIPMAPS`. */
export const GODOT_TEXTURE_FILTER_DEFAULT = 3;

/**
 * Godot's anisotropy ceiling is `1 << anisotropic_filtering_level`, a per-project
 * setting whose engine default is level 2 (4x). Pinned at 16 rather than plumbed
 * because every project in this corpus that states a level states 4 (= 16x), and
 * three clamps to the GPU maximum at upload — so this is a ceiling, never an
 * error. The one in-scope material in a default-level project is nearest-sampled
 * pixel art, where the difference is unobservable.
 */
export const GODOT_ANISOTROPY_MAX = 16;

export interface TextureFilterState {
  magFilter: THREE.MagnificationTextureFilter;
  minFilter: THREE.MinificationTextureFilter;
  generateMipmaps: boolean;
  anisotropy: number;
}

const STATES: Record<number, TextureFilterState> = {
  0: {
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestFilter,
    generateMipmaps: false,
    anisotropy: 1,
  },
  1: {
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearFilter,
    generateMipmaps: false,
    anisotropy: 1,
  },
  2: {
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestMipmapLinearFilter,
    generateMipmaps: true,
    anisotropy: 1,
  },
  3: {
    magFilter: THREE.LinearFilter,
    minFilter: THREE.LinearMipmapLinearFilter,
    generateMipmaps: true,
    anisotropy: 1,
  },
  4: {
    magFilter: THREE.NearestFilter,
    minFilter: THREE.NearestMipmapLinearFilter,
    generateMipmaps: true,
    anisotropy: GODOT_ANISOTROPY_MAX,
  },
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
  return STATES[filter ?? GODOT_TEXTURE_FILTER_DEFAULT] ?? STATES[GODOT_TEXTURE_FILTER_DEFAULT]!;
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
export function textureFilterMatches(
  texture: THREE.Texture,
  state: TextureFilterState
): boolean {
  const wanted = effectiveState(texture, state);
  return (
    texture.magFilter === wanted.magFilter &&
    texture.minFilter === wanted.minFilter &&
    texture.generateMipmaps === wanted.generateMipmaps &&
    texture.anisotropy === wanted.anisotropy
  );
}

/** The mip-free equivalent of a minification filter, for a texture with no mip chain. */
const WITHOUT_MIPMAPS: Partial<
  Record<THREE.MinificationTextureFilter, THREE.MinificationTextureFilter>
> = {
  [THREE.NearestMipmapLinearFilter]: THREE.NearestFilter,
  [THREE.NearestMipmapNearestFilter]: THREE.NearestFilter,
  [THREE.LinearMipmapLinearFilter]: THREE.LinearFilter,
  [THREE.LinearMipmapNearestFilter]: THREE.LinearFilter,
};

/**
 * Write the sampler state onto a texture the caller owns.
 *
 * A `*_WITH_MIPMAPS` filter does not CREATE a mip chain: mipmaps are a property
 * of the texture resource, and a procedural one never calls `generate_mipmaps`
 * (`scene/resources/gradient_texture.cpp`), so Godot's sampler reads base level
 * only. Manufacturing them here renders such a texture blurrier under
 * minification than the engine does.
 */
export function applyTextureFilterState(
  texture: THREE.Texture,
  state: TextureFilterState
): void {
  const wanted = effectiveState(texture, state);
  texture.magFilter = wanted.magFilter;
  texture.minFilter = wanted.minFilter;
  texture.generateMipmaps = wanted.generateMipmaps;
  texture.anisotropy = wanted.anisotropy;
}
