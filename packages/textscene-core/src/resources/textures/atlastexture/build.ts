/**
 * An `AtlasTexture`'s layout as a texture of its own size, as Godot presents it
 * (`AtlasTexture::draw`, `scene/resources/atlas_texture.cpp:158-164`; `get_image`
 * :245-256). Consumers size by `image.width`/`image.height` and set their own
 * `repeat` and `offset`, so a sheet with pre-windowed UVs would be re-windowed.
 */

import * as THREE from 'three';
import { imageSize, readImagePixels, type ImagePixels } from '../../formats/image/imagePixels';
import { copySampling } from '../copySampling';
import { carriesMipLevels } from '../godotTextureFilter';
import { texelTexture, textureMipChain } from '../texelTexture';
import type { MipLevel } from '../../processing/mipChain';
import { clamp } from '../../../godot/math/math';
import { copyGodotFormat } from '../sourceColorSpace';
import { isBottomUp } from '../../../utils/reversedRows';
import { perObject } from '../../../utils/perObject';
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
 * A decoded image's bytes, top row first, read once per image. Null when they cannot be read.
 * One readback serves every AtlasTexture cut from a decoded sheet.
 */
const decodedPixels = perObject((image: object): ImagePixels | null => readImagePixels(image) ?? null);

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
 * The crop `layout` describes, as a whole-texel blit, or null for an undecoded or unreadable image.
 * Null never means "draw the sheet": a whole sprite sheet is the failure this prevents.
 */
export function rasterizeAtlasTexture(
  sheet: THREE.Texture,
  layout: AtlasTextureLayout
): THREE.Texture | null {
  const atlas = imageSize(sheet.image);
  if (!atlas) return null;
  const raw = rawPixels(sheet, atlas);
  if (!raw) return null;
  // A material binds the atlas's own texture (`atlas_texture.cpp:55-58`), so the crop reads as it.
  const crop = copySampling(cropRawPixels(raw, layout), sheet);
  const sheetLevels = sheet.mipmaps as MipLevel[];
  // Half-float levels are no bytes: `mipChain` would average their bits, so such a crop carries no chain.
  if (!carriesMipLevels(sheet) || raw.data instanceof Uint16Array) return copyGodotFormat(crop, sheet);
  const rawLevels = sheetLevels.map((level) => ({ ...level, isBottomUp: raw.isBottomUp }));
  return copyGodotFormat(withSheetMipChain(crop, rawLevels, layout), sheet);
}

/**
 * `crop` with each level cut from the same window of the sheet's own chain, as Godot samples the
 * sheet's chain through the region. Every step the import ran on the sheet's levels carries over:
 * the renormalise, the roughness limiter and the compression's channels. Levels past the end of the
 * sheet's chain average the last one in byte space.
 */
function withSheetMipChain(
  crop: THREE.DataTexture,
  sheetLevels: RawPixels[],
  layout: AtlasTextureLayout
): THREE.DataTexture {
  const levels: MipLevel[] = [crop.image as MipLevel];
  for (let i = 1; i < sheetLevels.length && !isLastLevel(levels.at(-1)!); i++) {
    levels.push(croppedLevel(sheetLevels[i]!, layoutAtLevel(layout, i)));
  }
  const [, ...averaged] = textureMipChain(crop, levels.at(-1)!, false);
  return texelTexture(crop, [...levels, ...averaged]);
}

function isLastLevel({ width, height }: MipLevel): boolean {
  return width === 1 && height === 1;
}

/** `layout` at mip level `i` of the sheet, every size and offset halved `i` times as the chain halves. */
function layoutAtLevel(layout: AtlasTextureLayout, i: number): AtlasTextureLayout {
  const scale = 2 ** i;
  const down = (value: number) => Math.floor(value / scale);
  const atLeastOne = (value: number) => Math.max(1, down(value));
  const { source, dest } = layout;
  return {
    width: atLeastOne(layout.width),
    height: atLeastOne(layout.height),
    source: {
      x: down(source.x),
      y: down(source.y),
      width: atLeastOne(source.width),
      height: atLeastOne(source.height),
    },
    dest: { x: down(dest.x), y: down(dest.y) },
  };
}

/** One level's crop. */
function croppedLevel(raw: RawPixels, layout: AtlasTextureLayout): MipLevel {
  const data = new Uint8Array(layout.width * layout.height * 4);
  blit(raw, layout, data);
  return { data, width: layout.width, height: layout.height };
}

/** `raw`'s region cut into a texture of `layout`'s size, in the sheet's own texel type and row order. */
function cropRawPixels(raw: RawPixels, layout: AtlasTextureLayout): THREE.DataTexture {
  const isHalfFloat = raw.data instanceof Uint16Array;
  const texelCount = layout.width * layout.height * 4;
  const data = isHalfFloat ? new Uint16Array(texelCount) : new Uint8Array(texelCount);
  blit(raw, layout, data);
  const texture = new THREE.DataTexture(data, layout.width, layout.height, THREE.RGBAFormat);
  // Floats read raw and bytes as sRGB until `copyGodotFormat` records the sheet's format.
  texture.type = isHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
  texture.colorSpace = isHalfFloat ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
  texture.flipY = !raw.isBottomUp;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Copies `layout`'s region of `raw` into `out`, a zeroed array of `layout`'s size in `raw`'s texel
 * type. A fresh typed array is transparent (a zero half float is 0), so the margin the region does
 * not cover needs no clear. Godot clips the drawn rect to the region, not to the atlas
 * (`get_rect_region`, `atlas_texture.cpp:208`), so a region texel past the atlas reads the clamped
 * sampler's edge texel.
 */
function blit(raw: RawPixels, layout: AtlasTextureLayout, out: Uint8Array | Uint16Array): void {
  const { source, dest } = layout;

  // Layout rows count from the top, as Godot's do.
  const storedRow = (godotRow: number, height: number) => (raw.isBottomUp ? height - 1 - godotRow : godotRow);

  for (let row = 0; row < source.height; row += 1) {
    const dy = dest.y + row;
    if (dy < 0 || dy >= layout.height) continue;
    const fromRow = storedRow(clampToEdge(source.y + row, raw.height), raw.height);
    const toRow = storedRow(dy, layout.height);
    for (let col = 0; col < source.width; col += 1) {
      const dx = dest.x + col;
      if (dx < 0 || dx >= layout.width) continue;
      const from = (fromRow * raw.width + clampToEdge(source.x + col, raw.width)) * 4;
      const to = (toRow * layout.width + dx) * 4;
      out[to] = raw.data[from]!;
      out[to + 1] = raw.data[from + 1]!;
      out[to + 2] = raw.data[from + 2]!;
      out[to + 3] = raw.data[from + 3]!;
    }
  }
}

/** The texel a clamped sampler reads at `index` of an axis `size` texels long. */
function clampToEdge(index: number, size: number): number {
  return clamp(index, 0, size - 1);
}
