import * as THREE from 'three';

/** RGBA8 pixels of a flowmap image, first row = top row. */
export interface FlowmapPixels {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

/** Reads RGBA8 bytes out of whatever `Texture.image` holds. */
export type FlowmapPixelReader = (image: unknown) => FlowmapPixels | undefined;

/**
 * Read a texture image's RGBA8 bytes.
 *
 * A `DataTexture` already carries them (`image.data`). Everything the resource
 * pipeline loads is decoded by `THREE.TextureLoader` into an `HTMLImageElement`
 * with no `.data`, so those are drawn to a 2D canvas and read back with
 * `getImageData` — the same extraction `r3f/controls/imageToDataUrl.ts` performs
 * for a different output (a data URL), kept separate because only the two
 * `drawImage` lines are common.
 *
 * Returns `undefined` when there is nothing to read: an undecoded or zero-sized
 * image, no DOM (node/happy-dom tests), no 2D context, or a `getImageData` that
 * throws because the canvas is cross-origin tainted. Textures reach both hosts
 * as blob URLs built from bytes the host already fetched, so a taint is not
 * expected — but it must degrade to "no map" rather than break the material.
 *
 * Canvas 2D stores premultiplied alpha, so a pixel with low alpha loses
 * precision in R/G on the round trip. Those are the direction vector, which is
 * scaled by that same alpha downstream, so the error stays proportional to a
 * strength that is already near zero.
 */
export function readFlowmapPixels(image: unknown): FlowmapPixels | undefined {
  const img = image as
    | {
        data?: Uint8Array | Uint8ClampedArray;
        width?: number;
        height?: number;
        naturalWidth?: number;
        naturalHeight?: number;
      }
    | undefined;
  if (!img) return undefined;

  const width = img.naturalWidth || img.width || 0;
  const height = img.naturalHeight || img.height || 0;
  if (!width || !height) return undefined;
  if (img.data) return { data: img.data, width, height };

  const doc = globalThis.document;
  if (!doc) return undefined;
  try {
    const canvas = doc.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return undefined;
    ctx.drawImage(image as CanvasImageSource, 0, 0);
    const pixels = ctx.getImageData(0, 0, width, height);
    if (!pixels?.data || pixels.data.length < width * height * 4) return undefined;
    return { data: pixels.data, width, height };
  } catch {
    return undefined; // tainted canvas / unsupported image source
  }
}

/**
 * Repack a Godot anisotropy_flowmap for three.js: Godot stores per-pixel strength in the ALPHA
 * channel, three.js reads it from BLUE. Copy A → B on a fresh DataTexture with its own Source —
 * the cached input texture is never mutated (three's Texture.clone() SHARES the Source).
 *
 * Pixels come from `readFlowmapPixels`, which covers both a `DataTexture`'s raw buffer and a
 * decoded image read back through a canvas. Returns `undefined` only when no pixels are readable
 * at all; the caller then wires NO map, and the material keeps correct scalar-only anisotropy
 * rather than feeding three.js an arbitrary blue channel as "strength".
 *
 * The returned texture owns its pixel buffer — the caller disposes it.
 */
export function repackAnisotropyFlowmap(
  texture: THREE.Texture,
  readPixels: FlowmapPixelReader = readFlowmapPixels
): THREE.Texture | undefined {
  const pixels = readPixels(texture.image);
  if (!pixels) return undefined;

  const src = pixels.data;
  // Copy source and repack: ALPHA (byte 3) → BLUE (byte 2) per pixel.
  const dst = new Uint8Array(src);
  for (let i = 0; i < dst.length; i += 4) {
    const alpha = src[i + 3]!;
    dst[i + 2] = alpha;
  }

  const out = new THREE.DataTexture(dst, pixels.width, pixels.height, THREE.RGBAFormat);
  out.needsUpdate = true;
  out.wrapS = texture.wrapS;
  out.wrapT = texture.wrapT;
  out.magFilter = texture.magFilter;
  out.minFilter = texture.minFilter;
  // anisotropyMap is non-color data (direction + strength) — three.js requires NoColorSpace.
  out.colorSpace = THREE.NoColorSpace;
  out.flipY = texture.flipY;
  return out;
}
