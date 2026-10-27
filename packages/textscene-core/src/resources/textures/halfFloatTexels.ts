/**
 * Float texels as the half floats a texture uploads. WebGL2 always filters a half-float texture,
 * and filters a float one only with `OES_texture_float_linear`, without which three samples it
 * nearest. A half float keeps a value up to 65504.
 */

import * as THREE from 'three';

/**
 * @canonical Half floats from 32-bit floats
 */
export function toHalfFloatTexels(texels: Float32Array): Uint16Array {
  const halves = new Uint16Array(texels.length);
  for (let i = 0; i < texels.length; i++) halves[i] = THREE.DataUtils.toHalfFloat(texels[i]!);
  return halves;
}

/** `texels` as a texture uploads them: floats as half floats, bytes as they are. */
export function uploadedTexels(texels: Uint8Array | Float32Array): Uint8Array | Uint16Array {
  return texels instanceof Float32Array ? toHalfFloatTexels(texels) : texels;
}
