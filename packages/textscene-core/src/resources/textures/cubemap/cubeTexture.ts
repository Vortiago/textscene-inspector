import * as THREE from 'three';
import type { LayeredTexels } from '../layeredTexels';
import { uploadedTexels } from '../halfFloatTexels';
import { CUBE_FACES } from './decode';

/** The layers as the faces +X to -Z, each top row first as Godot uploads it. Null for other than six. */
export function cubeTexture(
  { texels, width, height, depth }: LayeredTexels<Uint8Array | Float32Array>,
  hasMipmaps: boolean
): THREE.CubeTexture | null {
  if (depth !== CUBE_FACES) return null;
  const uploaded = uploadedTexels(texels);
  const type = texels instanceof Float32Array ? THREE.HalfFloatType : THREE.UnsignedByteType;
  const faceTexels = width * height * 4;
  const faces = Array.from({ length: CUBE_FACES }, (_, face) => {
    const data = uploaded.subarray(face * faceTexels, (face + 1) * faceTexels);
    return new THREE.DataTexture(data, width, height, THREE.RGBAFormat, type);
  });
  const cube = new THREE.CubeTexture(faces);
  cube.format = THREE.RGBAFormat;
  cube.type = type;
  cube.flipY = false;
  cube.generateMipmaps = hasMipmaps;
  cube.minFilter = hasMipmaps ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  cube.unpackAlignment = 1;
  cube.needsUpdate = true;
  return cube;
}
