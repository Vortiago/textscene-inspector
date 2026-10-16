/** The one texel of a colour background, which is a 1x1 float texture. */

import type * as THREE from 'three';

export function textureTexel(texture: THREE.DataTexture): number[] {
  return Array.from(texture.image.data as Float32Array);
}
