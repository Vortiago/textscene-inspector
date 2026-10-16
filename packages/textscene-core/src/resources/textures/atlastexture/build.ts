/**
 * An `AtlasTexture`'s layout as a texture of its own size, as Godot presents it
 * (`AtlasTexture::draw`, `scene/resources/atlas_texture.cpp:158-164`; `get_image`
 * :245-256). Consumers size by `image.width`/`image.height` and set their own
 * `repeat` and `offset`, so a sheet with pre-windowed UVs would be re-windowed.
 */

import * as THREE from 'three';
import {
  imageSize,
  readImagePixels,
  type ImagePixels,
  type ImageSize,
} from '../../formats/image/imagePixels';
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

/** The part of the atlas a crop copies, in atlas texels. */
interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
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
  const atlas = imageSize(sheet.image);
  if (!atlas) return null;
  const region = clippedRegion(layout, atlas);
  if (!region) return null;
  const raw = rawPixels(sheet, atlas);
  if (!raw) return null;
  // A material binds the atlas's own texture (`atlas_texture.cpp:55-58`), so the crop reads as it.
  const crop = copySampling(cropRawPixels(raw, layout, region), sheet);
  const sheetLevels = sheet.mipmaps as MipLevel[];
  if (sheetLevels.length <= 1) return copyGodotFormat(crop, sheet);
  const rawLevels = sheetLevels.map((level) => ({ ...level, isBottomUp: raw.isBottomUp }));
  return copyGodotFormat(withSheetMipChain(crop, rawLevels, layout), sheet);
}

/**
 * The region of `layout` inside the atlas, or null when none is. Godot intersects the sampled rect
 * with the atlas (`get_rect_region` :208) and draws nothing when the result is empty (:209-211).
 */
function clippedRegion({ source }: AtlasTextureLayout, atlas: ImageSize): Region | null {
  const left = Math.max(source.x, 0);
  const top = Math.max(source.y, 0);
  const width = Math.min(source.x + source.width, atlas.width) - left;
  const height = Math.min(source.y + source.height, atlas.height) - top;
  return width > 0 && height > 0 ? { left, top, width, height } : null;
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

/** One level's crop, transparent where its region misses the level. */
function croppedLevel(raw: RawPixels, layout: AtlasTextureLayout): MipLevel {
  const region = clippedRegion(layout, raw);
  const data = region
    ? (blit(raw, layout, region) as Uint8Array)
    : new Uint8Array(layout.width * layout.height * 4);
  return { data, width: layout.width, height: layout.height };
}

/** `raw`'s `region` cut into a texture of `layout`'s size, in the sheet's own texel type and row order. */
function cropRawPixels(raw: RawPixels, layout: AtlasTextureLayout, region: Region): THREE.DataTexture {
  const isHalfFloat = raw.data instanceof Uint16Array;
  const texture = new THREE.DataTexture(
    blit(raw, layout, region),
    layout.width,
    layout.height,
    THREE.RGBAFormat
  );
  // Floats read raw and bytes as sRGB until `copyGodotFormat` records the sheet's format.
  texture.type = isHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
  texture.colorSpace = isHalfFloat ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
  texture.flipY = !raw.isBottomUp;
  texture.needsUpdate = true;
  return texture;
}

/**
 * The blit over raw RGBA texels: the destination starts fully transparent (a fresh typed array is
 * zeroed, and a zero half float is 0), so the margin the region does not cover needs no clear.
 */
function blit(raw: RawPixels, layout: AtlasTextureLayout, region: Region): Uint8Array | Uint16Array {
  const texelCount = layout.width * layout.height * 4;
  const out = raw.data instanceof Uint16Array ? new Uint16Array(texelCount) : new Uint8Array(texelCount);
  const destX = layout.dest.x + (region.left - layout.source.x);
  const destY = layout.dest.y + (region.top - layout.source.y);

  // Layout rows count from the top, as Godot's do.
  const storedRow = (godotRow: number, height: number) => (raw.isBottomUp ? height - 1 - godotRow : godotRow);

  for (let row = 0; row < region.height; row += 1) {
    const dy = destY + row;
    if (dy < 0 || dy >= layout.height) continue;
    const fromRow = storedRow(region.top + row, raw.height);
    const toRow = storedRow(dy, layout.height);
    for (let col = 0; col < region.width; col += 1) {
      const dx = destX + col;
      if (dx < 0 || dx >= layout.width) continue;
      const from = (fromRow * raw.width + (region.left + col)) * 4;
      const to = (toRow * layout.width + dx) * 4;
      out[to] = raw.data[from]!;
      out[to + 1] = raw.data[from + 1]!;
      out[to + 2] = raw.data[from + 2]!;
      out[to + 3] = raw.data[from + 3]!;
    }
  }
  return out;
}
