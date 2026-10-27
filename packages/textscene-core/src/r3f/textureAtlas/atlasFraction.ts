/** Where a texture lies in an atlas, as the fractions of it a shader samples by. */

import type { AtlasRect } from '../../resources/textures/atlastexture/types.js';

/**
 * `rect`, in texels, as fractions of an atlas of `atlasSize`.
 *
 * @canonical Where a texture lies in an atlas, as fractions of it
 */
export function fractionOfAtlas(rect: AtlasRect, atlasSize: { width: number; height: number }): AtlasRect {
  const { width, height } = atlasSize;
  return { x: rect.x / width, y: rect.y / height, width: rect.width / width, height: rect.height / height };
}
