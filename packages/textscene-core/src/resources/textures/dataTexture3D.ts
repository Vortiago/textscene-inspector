/**
 * The `THREE.Data3DTexture` a fog density samples. Godot's fog shader samples a density texture
 * linearly and clamped (`environment/fog.cpp:259-260`), and as raw values, since its uniform has
 * no `source_color`.
 */

import * as THREE from 'three';

/** Single-channel or RGBA texels, slice after slice, rows from the top. */
export type Texture3DFormat = typeof THREE.RedFormat | typeof THREE.RGBAFormat;

export function densityDataTexture3D(
  texels: Uint8Array,
  width: number,
  height: number,
  depth: number,
  format: Texture3DFormat
): THREE.Data3DTexture {
  const texture = new THREE.Data3DTexture(texels, width, height, depth);
  texture.format = format;
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.wrapR = THREE.ClampToEdgeWrapping;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}
