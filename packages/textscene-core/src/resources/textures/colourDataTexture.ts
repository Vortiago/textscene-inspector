/**
 * A `THREE.DataTexture` of colour texels a texture slot samples, sampled linearly and clamped as
 * Godot samples a procedural or saved texture. The texels run bottom-up (`utils/reversedRows.ts`).
 */

import * as THREE from 'three';
import { toHalfFloatTexels } from './halfFloatTexels';
import { recordGodotFormat } from './sourceColorSpace';

/**
 * `format` is the `Image::format_names` entry Godot holds the texels in, which decides whether a
 * colour slot reads them as sRGB (`sourceColorSpace`). Bytes upload tagged sRGB. Floats upload as
 * raw half floats tagged linear, which can pass 1. The 2D canvas retags either `NoColorSpace`.
 */
export function colourDataTexture(
  texels: Uint8Array | Float32Array,
  width: number,
  height: number,
  format: string
): THREE.DataTexture {
  const isFloat = texels instanceof Float32Array;
  const data = isFloat ? toHalfFloatTexels(texels) : texels;
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.type = isFloat ? THREE.HalfFloatType : THREE.UnsignedByteType;
  texture.colorSpace = isFloat ? THREE.LinearSRGBColorSpace : THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return recordGodotFormat(texture, format);
}
