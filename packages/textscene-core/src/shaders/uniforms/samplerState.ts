import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearMipmapNearestFilter,
  MirroredRepeatWrapping,
  NearestFilter,
  NearestMipmapLinearFilter,
  NearestMipmapNearestFilter,
  RepeatWrapping,
  type MagnificationTextureFilter,
  type MinificationTextureFilter,
  type Wrapping,
} from 'three';
import type { SamplerSettings } from './samplerTextures.js';

/** The project settings under `rendering/textures/default_filters/` that shape every sampler. */
export interface ProjectSampling {
  /** `anisotropic_filtering_level`: the anisotropic filters read up to `1 << level` samples. */
  readonly anisotropicFilteringLevel: number;
  /** `use_nearest_mipmap_filter`: a mipmap filter picks the nearest level, not a blend of two. */
  readonly useNearestMipmapFilter: boolean;
}

/** Godot's defaults for the project settings (`rendering_server.cpp:3749`). */
export const GODOT_SAMPLING: ProjectSampling = {
  anisotropicFilteringLevel: 2,
  useNearestMipmapFilter: false,
};

/** A sampler as three keeps it, on the texture it reads. */
export interface SamplerState {
  readonly magFilter: MagnificationTextureFilter;
  readonly minFilter: MinificationTextureFilter;
  readonly wrap: Wrapping;
  readonly anisotropy: number;
}

/** The minification filter of the nearest level and of two levels blended, by magnification filter. */
const MIPMAP_FILTERS = {
  [NearestFilter]: { nearest: NearestMipmapNearestFilter, blended: NearestMipmapLinearFilter },
  [LinearFilter]: { nearest: LinearMipmapNearestFilter, blended: LinearMipmapLinearFilter },
} as const;

/** A canvas item's `TEXTURE_REPEAT_MIRROR` has no shader hint, so `repeat_mirror` names it here. */
const WRAPS: Readonly<Record<string, Wrapping>> = {
  repeat_enable: RepeatWrapping,
  repeat_mirror: MirroredRepeatWrapping,
};

/** `samplers_rd_allocate` (`material_storage.cpp:2454`) for a texture of `levels` mip levels. */
export function samplerState(
  settings: SamplerSettings,
  levels: number,
  sampling: ProjectSampling
): SamplerState {
  const { filter, repeat } = settings;
  const magFilter = filter.startsWith('filter_nearest') ? NearestFilter : LinearFilter;
  const usesMipmaps = filter.includes('_mipmap') && levels > 1;
  const mipmapFilter = MIPMAP_FILTERS[magFilter][sampling.useNearestMipmapFilter ? 'nearest' : 'blended'];
  const minFilter = usesMipmaps ? mipmapFilter : magFilter;
  const isAnisotropic = filter.endsWith('_anisotropic');
  return {
    magFilter,
    minFilter,
    wrap: WRAPS[repeat] ?? ClampToEdgeWrapping,
    anisotropy: isAnisotropic ? 1 << sampling.anisotropicFilteringLevel : 1,
  };
}
