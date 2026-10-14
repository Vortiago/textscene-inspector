/**
 * An `AtlasTexture`'s layout as a texture of its own size, as Godot presents it
 * (`AtlasTexture::draw`, `scene/resources/atlas_texture.cpp:158-164`; `get_image`
 * :245-256). Consumers size by `image.width`/`image.height` and set their own
 * `repeat` and `offset`, so a sheet with pre-windowed UVs would be re-windowed.
 */

import * as THREE from 'three';
import { imageSize } from '../../formats/image/imagePixels';
import type { AtlasTextureLayout } from './types';

/**
 * The `{data, width, height}` a `DataTexture` carries. It is copied row by row:
 * a premultiplied canvas would zero the RGB behind alpha 0 that
 * `applyAlphaBorderFix` preserves. A `Uint16Array` holds the half floats
 * `colourDataTexture` uploads for a float image.
 */
interface RawPixels {
  data: Uint8Array | Uint8ClampedArray | Uint16Array;
  width: number;
  height: number;
  /** Row 0 is the bottom row: a typed array that uploads without `flipY` (`utils/reversedRows.ts`). */
  isBottomUp: boolean;
}

/** `sheet` as raw RGBA pixels, or null when its image is a drawable image source instead. */
function rawPixels(sheet: THREE.Texture, atlas: { width: number; height: number }): RawPixels | null {
  const data = (sheet.image as { data?: unknown } | null)?.data;
  if (!ArrayBuffer.isView(data)) return null;
  // A crop indexes 4 channels per texel only. Other formats go to the canvas path,
  // which declines in turn.
  if ((data as RawPixels['data']).length !== atlas.width * atlas.height * 4) return null;
  return {
    data: data as RawPixels['data'],
    width: atlas.width,
    height: atlas.height,
    isBottomUp: !sheet.flipY,
  };
}

/**
 * The crop `layout` describes, as a whole-texel blit with smoothing off, or null:
 * an undecoded image, a region that misses the atlas, or no 2D canvas. Null never
 * means "draw the sheet": a whole sprite sheet is the failure this prevents.
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
  if (raw) return cropRawPixels(raw, layout, left, top, sw, sh);

  const doc = globalThis.document;
  if (!doc) return null;
  try {
    const canvas = doc.createElement('canvas');
    canvas.width = layout.width;
    canvas.height = layout.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      image as CanvasImageSource,
      left,
      top,
      sw,
      sh,
      layout.dest.x + (left - layout.source.x),
      layout.dest.y + (top - layout.source.y),
      sw,
      sh
    );

    const texture = new THREE.CanvasTexture(canvas);
    // The tag `createTextureFromBuffer` puts on a loaded image: these are the
    // sheet's sRGB bytes, and a consumer that needs another retags its own clone.
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  } catch {
    return null; // A tainted canvas or an unsupported image source.
  }
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
  // The sheet's own tags, as `colourDataTexture` sets them: floats read raw, bytes as sRGB.
  texture.type = isHalfFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
  texture.colorSpace = isHalfFloat ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
  texture.flipY = !raw.isBottomUp;
  texture.needsUpdate = true;
  return texture;
}
