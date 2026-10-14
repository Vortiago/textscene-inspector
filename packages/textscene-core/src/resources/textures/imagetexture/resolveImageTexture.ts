/**
 * Resolves an `ImageTexture` sub-resource, whose `image` holds its pixels inline
 * (`scene/resources/image_texture.cpp`), to a `THREE.DataTexture`. An ImageTexture at a file path
 * is the image slice's: this reads only the saved pixels.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { reversedRows } from '../../../utils/reversedRows';
import { colourDataTexture } from '../colourDataTexture';
import { decodeImageRef } from '../image/decode';
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

/** Null with no `image`, or one `decodeImageRef` declines. */
function build(
  properties: Record<string, string>,
  resources: readonly TscnInternalResource[]
): THREE.DataTexture | null {
  const pixels = decodeImageRef(properties.image, resources);
  if (!pixels) return null;
  return colourDataTexture(
    reversedRows(pixels.data, pixels.width, pixels.height),
    pixels.width,
    pixels.height
  );
}
