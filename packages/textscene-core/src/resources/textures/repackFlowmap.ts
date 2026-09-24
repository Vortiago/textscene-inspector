import * as THREE from 'three';
import { readImagePixels, type ImagePixels } from '../../r3f/controls/withImageCanvas';

/** RGBA8 pixels of a flowmap image, first row = top row. */
export type FlowmapPixels = ImagePixels;

/**
 * A flowmap image's RGBA8 bytes through `readImagePixels`. `undefined` degrades
 * to no map. Its premultiplied round trip zeroes R/G at alpha 0, which is inert
 * at the base level: the direction is scaled by that same alpha.
 */
export function readFlowmapPixels(image: unknown): FlowmapPixels | undefined {
  return readImagePixels(image);
}

/**
 * Repacks a Godot anisotropy_flowmap's alpha strength into the blue channel three.js
 * reads, on a new DataTexture: `Texture.clone()` shares the cached Source. `undefined`
 * when no pixels are readable, so the material keeps scalar-only anisotropy. The
 * caller disposes the returned texture.
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
  // Alpha (byte 3) to blue (byte 2), per pixel.
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
  // Parity limitation: a mip level mixes a zero-alpha texel's zeroed direction into a
  // non-zero strength, where Godot averages the real direction, so the direction turns
  // 90 degrees at that level. Only a decode with UNPACK_PREMULTIPLY_ALPHA_WEBGL off,
  // not a 2D canvas, would remove it.
  out.minFilter = texture.minFilter;
  // A DataTexture defaults to no mipmaps, which samples level 0 at every distance.
  // Carry the source's intent, so the repack changes channels and nothing else.
  out.generateMipmaps = texture.generateMipmaps;
  // anisotropyMap is non-colour data (direction and strength): three.js requires NoColorSpace.
  out.colorSpace = THREE.NoColorSpace;
  out.flipY = texture.flipY;
  return out;
}
