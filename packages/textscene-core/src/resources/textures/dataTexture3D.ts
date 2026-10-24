/**
 * A `THREE.Data3DTexture` of raw values, sampled linearly and clamped: how Godot's fog shader
 * samples a density texture (`environment/fog.cpp:259-260`), with no `source_color` on its
 * uniform. The fog is the one Texture3D consumer the previewer draws.
 */

import * as THREE from 'three';
import { uploadedTexels } from './halfFloatTexels';

/** Single-channel or RGBA texels, slice after slice, rows from the top. */
type Texture3DFormat = typeof THREE.RedFormat | typeof THREE.RGBAFormat;

/** Bytes upload as unsigned normalised, and floats as half floats that keep their raw values. */
export function dataTexture3D(
  texels: Uint8Array | Float32Array,
  width: number,
  height: number,
  depth: number,
  format: Texture3DFormat
): THREE.Data3DTexture {
  const texture = new THREE.Data3DTexture(uploadedTexels(texels), width, height, depth);
  texture.format = format;
  texture.type = texels instanceof Float32Array ? THREE.HalfFloatType : THREE.UnsignedByteType;
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
