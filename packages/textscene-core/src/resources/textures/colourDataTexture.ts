/**
 * A `THREE.DataTexture` of colour texels a texture slot samples, sampled linearly and clamped as
 * Godot samples a procedural or saved texture. The texels run bottom-up (`utils/reversedRows.ts`).
 */

import * as THREE from 'three';
import { uploadedTexels } from './halfFloatTexels';
import { recordGodotFormat } from './sourceColorSpace';

/**
 * `format` is the `Image::format_names` entry Godot holds the texels in. A format with an sRGB view
 * uploads tagged sRGB, and every other format is pinned `NoColorSpace` (`recordGodotFormat`). Floats
 * upload as raw half floats, which can pass 1.
 */
export function colourDataTexture(
  texels: Uint8Array | Float32Array,
  width: number,
  height: number,
  format: string
): THREE.DataTexture {
  const texture = new THREE.DataTexture(uploadedTexels(texels), width, height, THREE.RGBAFormat);
  texture.type = texels instanceof Float32Array ? THREE.HalfFloatType : THREE.UnsignedByteType;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return recordGodotFormat(texture, format);
}
