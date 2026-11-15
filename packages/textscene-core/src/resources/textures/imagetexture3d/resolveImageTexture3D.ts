/**
 * Builds the `THREE.Data3DTexture` of a decoded `ImageTexture3D`, rows from the top as every
 * density texture runs.
 */

import * as THREE from 'three';
import { dataTexture3D } from '../dataTexture3D';
import { rasterizedTexture, type ProceduralTextureResolution } from '../rasterizedTexture';
import type { ImageTexture3DSource } from '../texture3d/types';
import { decodeImageTexture3D } from './decode';

export function imageTexture3D(
  source: ImageTexture3DSource
): ProceduralTextureResolution<THREE.Data3DTexture> | null {
  return rasterizedTexture(source, 'ImageTexture3D', () => build(source));
}

function build({ images }: ImageTexture3DSource): THREE.Data3DTexture | null {
  const volume = decodeImageTexture3D(images);
  if (!volume) return null;
  return dataTexture3D(volume.texels, volume.width, volume.height, volume.depth, THREE.RGBAFormat);
}
