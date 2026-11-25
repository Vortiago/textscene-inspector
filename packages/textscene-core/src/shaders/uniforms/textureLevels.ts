import {
  Data3DTexture,
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
  const { width = 1, height = 1, depth = 1 } = imageSizeOf(source.image);
  // A 3D texture's levels halve its depth too, and a 2D array's keep every layer.
  const longest = Math.max(width, height, source instanceof Data3DTexture ? depth : 1, 1);
  return Math.floor(Math.log2(longest)) + 1;
}

interface ImageSize {
  readonly width?: number;
  readonly height?: number;
  readonly depth?: number;
}

/** A cube's image is its six faces of one size: the faces' list has no size of its own. */
export const imageSizeOf = (image: unknown): ImageSize =>
  ((Array.isArray(image) ? image[0] : image) ?? {}) as ImageSize;

const MIPMAP_FILTERS: ReadonlySet<number> = new Set([
  NearestMipmapNearestFilter,
  NearestMipmapLinearFilter,
  LinearMipmapNearestFilter,
  LinearMipmapLinearFilter,
]);

/** The last level a sampler reads: a filter without mipmaps reads level 0 only. */
export const lastLevelOf = (texture: Texture): number =>
  MIPMAP_FILTERS.has(texture.minFilter) ? levelsOf(texture) - 1 : 0;
