import * as THREE from 'three';
import { readImagePixels, type ImagePixels } from '../../r3f/controls/withImageCanvas';

/** RGBA8 pixels of a flowmap image, first row = top row. */
export type FlowmapPixels = ImagePixels;

/**
 * Read a flowmap image's RGBA8 bytes — `readImagePixels`, which owns the shared
 * drawable-image policy, under the name this slice reads it by. `undefined`
 * must degrade to "no map" rather than break the material.
 *
 * What the shared reader's premultiplied round trip costs A FLOWMAP: a pixel
 * with low alpha loses precision in R/G, and one with alpha 0 loses them
 * outright — the readback reports black where the source held a direction. At
 * the base level that is inert: R/G are the direction vector, scaled downstream
 * by that same alpha, so the error stays proportional to a strength that is
 * already near zero.
 *
 * PARITY LIMITATION (minified flowmap): it stops being inert once mipmaps are
 * in play. Averaging mixes a zero-alpha texel's zeroed direction into coarser
 * levels whose strength is NOT zero, where Godot — mipmapping the intact image
 * — averages the real direction. A half-transparent flowmap that reads one
 * constant direction at every level in Godot holds that direction here only
 * until the first level mixing the two alpha regimes, then turns 90 degrees at
 * unchanged strength. Only a decode that never premultiplies (a WebGL upload
 * read back with UNPACK_PREMULTIPLY_ALPHA_WEBGL off, rather than a 2D canvas)
 * would remove it.
 */
export function readFlowmapPixels(image: unknown): FlowmapPixels | undefined {
  return readImagePixels(image);
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
