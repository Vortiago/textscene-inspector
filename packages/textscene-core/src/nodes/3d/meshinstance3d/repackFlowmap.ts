import * as THREE from 'three';
import { imageSize, withImageCanvas } from '../../../r3f/controls/withImageCanvas';

/** RGBA8 pixels of a flowmap image, first row = top row. */
export interface FlowmapPixels {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Read a texture image's RGBA8 bytes.
 *
 * A `DataTexture` already carries them (`image.data`). Everything the resource
 * pipeline loads is decoded by `THREE.TextureLoader` into an `HTMLImageElement`
 * with no `.data`, so those go through `withImageCanvas` — which owns the
 * drawable-image policy shared with `imageToDataUrl` — and come back via
 * `getImageData`. `undefined` means no pixels were readable (undecoded image,
 * no DOM, no 2D context, tainted canvas); textures reach both hosts as blob
 * URLs built from bytes the host already fetched, so a taint is not expected,
 * but it must degrade to "no map" rather than break the material.
 *
 * Canvas 2D stores premultiplied alpha, so a pixel with low alpha loses
 * precision in R/G on the round trip. Those are the direction vector, which is
 * scaled by that same alpha downstream, so the error stays proportional to a
 * strength that is already near zero.
 */
export function readFlowmapPixels(image: unknown): FlowmapPixels | undefined {
  const raw = (image as { data?: Uint8Array | Uint8ClampedArray } | null)?.data;
  if (raw) {
    const size = imageSize(image);
    return size ? { data: raw, ...size } : undefined;
  }
  return withImageCanvas(
    image,
    (ctx, { width, height }) => ({ data: ctx.getImageData(0, 0, width, height).data, width, height }),
    { willReadFrequently: true }
  );
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
  // Seam, not API: happy-dom cannot rasterize, so injecting the read is the only
  // way a test reaches the image-backed branch. Production passes one argument.
  readPixels: (image: unknown) => FlowmapPixels | undefined = readFlowmapPixels
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
  // A DataTexture defaults to NO mipmaps, so carrying over a mipmapped minFilter alone leaves
  // the map sampling level 0 at every distance: three allocates a single level, and a minified
  // surface aliases where the source image would filter. Carry the source's intent, so the
  // repack changes channels and nothing else.
  out.generateMipmaps = texture.generateMipmaps;
  // anisotropyMap is non-color data (direction + strength) — three.js requires NoColorSpace.
  out.colorSpace = THREE.NoColorSpace;
  out.flipY = texture.flipY;
  return out;
}
