import type * as THREE from 'three';
import { rasterizedTexture, type ProceduralTextureResolution } from '../rasterizedTexture';
import { decodeCubemapFaces } from './decode';
import { savedImageHasMipmaps } from '../image/decode';
import { cubeTexture } from './cubeTexture';
import type { ImageCubemapSource } from './types';

export function imageCubemap(
  source: ImageCubemapSource
): ProceduralTextureResolution<THREE.CubeTexture> | null {
  return rasterizedTexture(source, 'Cubemap', () => build(source));
}

/** three generates the mip chain where Godot reads the saved one, which a box filter makes alike. */
function build({ images }: ImageCubemapSource): THREE.CubeTexture | null {
  const faces = decodeCubemapFaces(images);
  const first = images[0];
  return faces && first ? cubeTexture(faces, savedImageHasMipmaps(first)) : null;
}
