/**
 * Resolves an `ImageTexture3D` sub-resource to a `THREE.Data3DTexture`, rows from the top as every
 * density texture runs.
 */

import * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { dataTexture3D } from '../dataTexture3D';
import {
  resolveProceduralSubResource,
  type ProceduralTextureResolution,
} from '../resolveProceduralSubResource';
import { decodeImageTexture3D } from './decode';

export function resolveImageTexture3D(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): ProceduralTextureResolution<THREE.Data3DTexture> | null {
  return resolveProceduralSubResource(ref, internalResources, 'ImageTexture3D', build);
}

function build(
  properties: Record<string, string>,
  resources: readonly TscnInternalResource[]
): THREE.Data3DTexture | null {
  const volume = decodeImageTexture3D(properties, resources);
  if (!volume) return null;
  return dataTexture3D(volume.texels, volume.width, volume.height, volume.depth, THREE.RGBAFormat);
}
