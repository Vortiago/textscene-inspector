/**
 * Resolves an `ImageTexture` sub-resource, whose `image` holds its pixels inline
 * (`scene/resources/image_texture.cpp`), to a `THREE.DataTexture`. An ImageTexture at a file path
 * is the image slice's: this reads only the saved pixels.
 */

import * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { reversedRows } from '../../../utils/reversedRows';
import { resolveSubResourceRef } from '../../SubResourceResolver';
import { decodeImage } from '../image/decode';
import {
  resolveProceduralSubResource,
  type ProceduralTextureResolution,
} from '../resolveProceduralSubResource';

export function resolveImageTexture(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): ProceduralTextureResolution<THREE.DataTexture> | null {
  return resolveProceduralSubResource(ref, internalResources, 'ImageTexture', build);
}

/** Null with no `image`, or one `decodeImage` declines. */
function build(
  properties: Record<string, string>,
  resources: readonly TscnInternalResource[]
): THREE.DataTexture | null {
  const image = resolveSubResourceRef(properties.image, resources);
  const pixels = image?.type === 'Image' ? decodeImage(image.data) : null;
  if (!pixels) return null;
  // Bottom-up, as every typed-array texture in this previewer runs (`utils/reversedRows.ts`).
  const texture = new THREE.DataTexture(
    reversedRows(pixels.data, pixels.width, pixels.height),
    pixels.width,
    pixels.height,
    THREE.RGBAFormat
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
