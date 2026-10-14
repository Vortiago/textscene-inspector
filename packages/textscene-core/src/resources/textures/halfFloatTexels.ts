/**
 * Float texels as the half floats a texture uploads. WebGL2 always filters a half-float texture,
 * and filters a float one only with `OES_texture_float_linear`, without which three samples it
 * nearest. A half float keeps a value up to 65504.
 */

import * as THREE from 'three';

export function toHalfFloatTexels(texels: Float32Array): Uint16Array {
  const halves = new Uint16Array(texels.length);
  for (let i = 0; i < texels.length; i++) halves[i] = THREE.DataUtils.toHalfFloat(texels[i]!);
  return halves;
}
