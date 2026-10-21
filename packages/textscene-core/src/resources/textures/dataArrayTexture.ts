/**
 * A `THREE.DataArrayTexture` of HDR values, sampled linearly and clamped at mipmap 0: how Godot's
 * scene shader samples a lightmap atlas (`scene_forward_clustered.glsl:1856,1873`). A lightmap is
 * the one texture array consumer the previewer draws.
 */

import * as THREE from 'three';

/** RGBA half-float bits, layer after layer, rows from the top. */
export function dataArrayTexture(
  texels: Uint16Array,
  width: number,
  height: number,
  depth: number
): THREE.DataArrayTexture {
  const texture = new THREE.DataArrayTexture(texels, width, height, depth);
  texture.format = THREE.RGBAFormat;
  texture.type = THREE.HalfFloatType;
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}
