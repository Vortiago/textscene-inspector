/** The texels of a cube built from 1x1 float faces, such as a colour background, one array per face. */

import type * as THREE from 'three';

export function cubeFaceTexels(cube: THREE.CubeTexture): number[][] {
  return (cube.image as THREE.DataTexture[]).map((face) => Array.from(face.image.data as Float32Array));
}
