/** Where a texture lies in an atlas, as the fractions of it a shader samples by. */

/** A rectangle: left, top, width and height, top row first. */
export interface AtlasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * `rect`, in texels, as fractions of an atlas of `atlasSize`.
 *
 * @oneWay Where a texture lies in an atlas, as fractions of it
 */
export function fractionOfAtlas(rect: AtlasRect, atlasSize: { width: number; height: number }): AtlasRect {
  const { width, height } = atlasSize;
  return { x: rect.x / width, y: rect.y / height, width: rect.width / width, height: rect.height / height };
}
