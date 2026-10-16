/** The texels of a colour background, which is built from 1x1 float textures. */

import type * as THREE from 'three';

/** The one texel of a flat colour background. */
export function textureTexel(texture: THREE.DataTexture): number[] {
  return Array.from(texture.image.data as Float32Array);
}

/** The one texel of each face of a fogged colour background's cube. */
export function cubeFaceTexels(cube: THREE.CubeTexture): number[][] {
  return (cube.image as THREE.DataTexture[]).map(textureTexel);
}
