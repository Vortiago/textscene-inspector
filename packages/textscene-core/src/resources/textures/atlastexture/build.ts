/**
 * An `AtlasTexture`'s layout as a texture of its own size, as Godot presents it
 * (`AtlasTexture::draw`, `scene/resources/atlas_texture.cpp:158-164`; `get_image`
 * :245-256). Consumers size by `image.width`/`image.height` and set their own
 * `repeat` and `offset`, so a sheet with pre-windowed UVs would be re-windowed.
 */

import * as THREE from 'three';
import { imageSize, readImagePixels, type ImagePixels } from '../../formats/image/imagePixels';
import { copySampling } from '../copySampling';
import { texelTexture, textureMipChain } from '../texelTexture';
import type { MipLevel } from '../../processing/mipChain';
import { copyGodotFormat } from '../sourceColorSpace';
import { isBottomUp } from '../../../utils/reversedRows';
import type { AtlasTextureLayout } from './types';

/**
 * A sheet's RGBA texels, copied row by row: a premultiplied canvas would zero the RGB behind
 * alpha 0 that Godot keeps. A `Uint16Array` holds the half floats `colourDataTexture` uploads
 * for a float image.
 */
interface RawPixels {
  data: Uint8Array | Uint8ClampedArray | Uint16Array;
  width: number;
  height: number;
  /** Row 0 is the bottom row: a typed array that uploads without `flipY` (`utils/reversedRows.ts`). */
  isBottomUp: boolean;
}

/**
 * Written only by `decodedPixels`. One readback serves every AtlasTexture cut from a decoded
 * sheet, and an entry goes with its image.
 */
const decodedSheetPixels = new WeakMap<object, ImagePixels | null>();

/** A decoded image's bytes, top row first, read once per image. Null when they cannot be read. */
function decodedPixels(image: object): ImagePixels | null {
  let pixels = decodedSheetPixels.get(image);
  if (pixels === undefined) {
    pixels = readImagePixels(image) ?? null;
    decodedSheetPixels.set(image, pixels);
  }
  return pixels;
}

/** `sheet`'s texels, or null when they cannot be read or are not 4 channels per texel. */
function rawPixels(sheet: THREE.Texture, atlas: { width: number; height: number }): RawPixels | null {
  const image = sheet.image as Partial<RawPixels> | null;
  if (!image) return null;
  const own = image.data;
  const pixels = ArrayBuffer.isView(own)
    ? { data: own, isBottomUp: isBottomUp(sheet) }
    : { data: decodedPixels(image)?.data, isBottomUp: false };
  if (pixels.data?.length !== atlas.width * atlas.height * 4) return null;
  return { data: pixels.data, width: atlas.width, height: atlas.height, isBottomUp: pixels.isBottomUp };
}

/**
 * The crop `layout` describes, as a whole-texel blit, or null: an undecoded or unreadable
 * image, or a region that misses the atlas. Null never means "draw the sheet": a whole
 * sprite sheet is the failure this prevents.
 */
export function rasterizeAtlasTexture(
  sheet: THREE.Texture,
  layout: AtlasTextureLayout
): THREE.Texture | null {
  const image: unknown = sheet.image;
  const atlas = imageSize(image);
  if (!atlas) return null;

  // Godot intersects the sampled rect with the atlas
  // (`get_rect_region` :208) and draws nothing when the result is empty
  // (:209-211). Clipping the source shifts the destination by the same amount,
  // leaving the uncovered part of the box transparent.
  const left = Math.max(layout.source.x, 0);
  const top = Math.max(layout.source.y, 0);
  const right = Math.min(layout.source.x + layout.source.width, atlas.width);
  const bottom = Math.min(layout.source.y + layout.source.height, atlas.height);
  const sw = right - left;
  const sh = bottom - top;
  if (sw <= 0 || sh <= 0) return null;

  const raw = rawPixels(sheet, atlas);
  if (!raw) return null;
  // A material binds the atlas's own texture (`atlas_texture.cpp:55-58`), so the crop reads as it.
  const crop = copySampling(cropRawPixels(raw, layout, left, top, sw, sh), sheet);
  return copyGodotFormat(sheet.mipmaps.length > 1 ? withByteMipChain(crop) : crop, sheet);
}

/**
 * `crop` with the chain the sheet's import built over its own bytes, averaged in byte space. A
 * chain the GPU built would average an sRGB crop in linear light.
 */
function withByteMipChain(crop: THREE.DataTexture): THREE.DataTexture {
  return texelTexture(crop, textureMipChain(crop, crop.image as MipLevel, false));
}

/**
 * The same blit over raw RGBA texels, in the sheet's own texel type and row order: the
 * destination starts fully transparent (a fresh typed array is zeroed, and a
 * zero half float is 0), so the margin the region does not cover needs no
 * separate clear.
 */
function cropRawPixels(
  raw: RawPixels,
  layout: AtlasTextureLayout,
  left: number,
  top: number,
  sw: number,
  sh: number
): THREE.DataTexture {
  const isHalfFloat = raw.data instanceof Uint16Array;
  const texelCount = layout.width * layout.height * 4;
  const out = isHalfFloat ? new Uint16Array(texelCount) : new Uint8Array(texelCount);
  const destX = layout.dest.x + (left - layout.source.x);
  const destY = layout.dest.y + (top - layout.source.y);

  // Layout rows count from the top, as Godot's do.
  const storedRow = (godotRow: number, height: number) => (raw.isBottomUp ? height - 1 - godotRow : godotRow);

  for (let row = 0; row < sh; row += 1) {
    const dy = destY + row;
    if (dy < 0 || dy >= layout.height) continue;
    const fromRow = storedRow(top + row, raw.height);
    const toRow = storedRow(dy, layout.height);
    for (let col = 0; col < sw; col += 1) {
      const dx = destX + col;
      if (dx < 0 || dx >= layout.width) continue;
      const from = (fromRow * raw.width + (left + col)) * 4;
      const to = (toRow * layout.width + dx) * 4;
      out[to] = raw.data[from]!;
      out[to + 1] = raw.data[from + 1]!;
      out[to + 2] = raw.data[from + 2]!;
      out[to + 3] = raw.data[from + 3]!;
    }
  }

  const texture = new THREE.DataTexture(out, layout.width, layout.height, THREE.RGBAFormat);
  // Floats read raw and bytes as sRGB until `copyGodotFormat` records the sheet's format.
  texture.type = isHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
  texture.colorSpace = isHalfFloat ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
  texture.flipY = !raw.isBottomUp;
  texture.needsUpdate = true;
  return texture;
}
