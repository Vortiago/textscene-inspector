/**
 * An `AtlasTexture`'s layout as a texture of its own size, as Godot presents it
 * (`AtlasTexture::draw`, `scene/resources/atlas_texture.cpp:158-164`; `get_image`
 * :245-256). Consumers size by `image.width`/`image.height` and set their own
 * `repeat` and `offset`, so a sheet with pre-windowed UVs would be re-windowed.
 */

import * as THREE from 'three';
import { imageSize } from '../../../r3f/controls/withImageCanvas';
import type { AtlasTextureLayout } from './types';

/**
 * The `{data, width, height}` a `DataTexture` carries. It is copied row by row:
 * a premultiplied canvas would zero the RGB behind alpha 0 that
 * `applyAlphaBorderFix` preserves.
 */
interface RawPixels {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

/** `image` as raw RGBA pixels, or null when it is a drawable image source instead. */
function rawPixels(image: unknown, atlas: { width: number; height: number }): RawPixels | null {
  const candidate = image as Partial<RawPixels> | null;
  const data = candidate?.data;
  if (!ArrayBuffer.isView(data)) return null;
  // A crop indexes 4 bytes per texel only. Other formats go to the canvas path,
  // which declines in turn.
  if (data.length !== atlas.width * atlas.height * 4) return null;
  return { data: data as Uint8Array, width: atlas.width, height: atlas.height };
}

/**
 * The crop `layout` describes, as a whole-texel blit with smoothing off, or null:
 * an undecoded image, a region that misses the atlas, or no 2D canvas. Null never
 * means "draw the sheet": a whole sprite sheet is the failure this prevents.
 */
export function rasterizeAtlasTexture(
  image: unknown,
  layout: AtlasTextureLayout
): THREE.Texture | null {
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

  const raw = rawPixels(image, atlas);
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
 * The same blit over raw RGBA bytes: the destination starts fully transparent
 * (a fresh `Uint8Array` is zeroed), so the margin the region does not cover
 * needs no separate clear.
 */
function cropRawPixels(
  raw: RawPixels,
  layout: AtlasTextureLayout,
  left: number,
  top: number,
  sw: number,
  sh: number
): THREE.DataTexture {
  const out = new Uint8Array(layout.width * layout.height * 4);
  const destX = layout.dest.x + (left - layout.source.x);
  const destY = layout.dest.y + (top - layout.source.y);

  for (let row = 0; row < sh; row += 1) {
    const dy = destY + row;
    if (dy < 0 || dy >= layout.height) continue;
    for (let col = 0; col < sw; col += 1) {
      const dx = destX + col;
      if (dx < 0 || dx >= layout.width) continue;
      const from = ((top + row) * raw.width + (left + col)) * 4;
      const to = (dy * layout.width + dx) * 4;
      out[to] = raw.data[from]!;
      out[to + 1] = raw.data[from + 1]!;
      out[to + 2] = raw.data[from + 2]!;
      out[to + 3] = raw.data[from + 3]!;
    }
  }

  const texture = new THREE.DataTexture(out, layout.width, layout.height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  // Row 0 is the sheet's row 0, and a DataTexture uploads unflipped, so the crop
  // lines up with its sheet.
  texture.flipY = false;
  texture.needsUpdate = true;
  return texture;
}
