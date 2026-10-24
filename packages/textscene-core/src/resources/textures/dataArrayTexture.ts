/**
 * A `THREE.DataArrayTexture` sampled linearly and clamped at mipmap 0: how Godot's scene shader
 * samples a lightmap atlas and its shadowmask (`scene_forward_clustered.glsl:1856,1873`, `:2268-2270`).
 * A lightmap is the one texture array consumer the previewer draws.
 */

import * as THREE from 'three';

/**
 * Texels, layer after layer, rows from the top: the RGBA half-float bits of an HDR lightmap, or
 * the red bytes of a shadowmask, which sample as the byte over 255.
 */
export function dataArrayTexture(
  texels: Uint16Array | Uint8Array,
  width: number,
  height: number,
  depth: number
): THREE.DataArrayTexture {
  const texture = new THREE.DataArrayTexture(texels, width, height, depth);
  const isHdr = texels instanceof Uint16Array;
  texture.format = isHdr ? THREE.RGBAFormat : THREE.RedFormat;
  texture.type = isHdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}
