import {
  LinearMipmapLinearFilter,
  LinearMipmapNearestFilter,
  NearestMipmapLinearFilter,
  NearestMipmapNearestFilter,
  type Texture,
} from 'three';

/** The mip levels a texture holds: its own list, or the chain three generates for it. */
export function levelsOf(source: Texture): number {
  if (source.mipmaps && source.mipmaps.length > 0) return source.mipmaps.length;
  if (!source.generateMipmaps) return 1;
  const { width = 1, height = 1 } = (source.image ?? {}) as { width?: number; height?: number };
  return Math.floor(Math.log2(Math.max(width, height, 1))) + 1;
}

const MIPMAP_FILTERS: ReadonlySet<number> = new Set([
  NearestMipmapNearestFilter,
  NearestMipmapLinearFilter,
  LinearMipmapNearestFilter,
  LinearMipmapLinearFilter,
]);

/** The last level a sampler reads: a filter without mipmaps reads level 0 only. */
export const lastLevelOf = (texture: Texture): number =>
  MIPMAP_FILTERS.has(texture.minFilter) ? levelsOf(texture) - 1 : 0;
