import * as THREE from 'three';

/**
 * Repack a Godot anisotropy_flowmap for three.js: Godot stores per-pixel strength in the ALPHA
 * channel, three.js reads it from BLUE. Copy A → B on a fresh DataTexture with its own Source —
 * the cached input texture is never mutated (three's Texture.clone() SHARES the Source).
 *
 * Returns `undefined` for a non-DataTexture flowmap (e.g. a production PNG decoding to an
 * HTMLImageElement with no raw `.data`) so the caller wires NO map and the material falls back
 * to correct scalar-only anisotropy instead of a wrong-channel map.
 */
export function repackAnisotropyFlowmap(texture: THREE.Texture): THREE.Texture | undefined {
  const img = texture.image as { data?: Uint8Array; width: number; height: number };
  if (!img?.data) return undefined;

  const src = img.data;
  // Copy source and repack: ALPHA (byte 3) → BLUE (byte 2) per pixel.
  const dst = new Uint8Array(src);
  for (let i = 0; i < dst.length; i += 4) {
    const alpha = src[i + 3]!;
    dst[i + 2] = alpha;
  }

  const out = new THREE.DataTexture(dst, img.width, img.height, THREE.RGBAFormat);
  out.needsUpdate = true;
  out.wrapS = texture.wrapS;
  out.wrapT = texture.wrapT;
  out.magFilter = texture.magFilter;
  out.minFilter = texture.minFilter;
  out.colorSpace = texture.colorSpace;
  out.flipY = texture.flipY;
  return out;
}
