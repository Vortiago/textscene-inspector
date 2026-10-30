/**
 * Resolves an `ImageTexture` sub-resource, whose `image` holds its pixels inline
 * (`scene/resources/image_texture.cpp`), to a `THREE.DataTexture`. An ImageTexture at a file path
 * is the image slice's: this reads only the saved pixels.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { reverseRowsInPlace } from '../../../utils/reversedRows';
import { colourDataTexture } from '../colourDataTexture';
import { uploadedTexels } from '../halfFloatTexels';
import { decodeMipmappedImageRef, type DecodedLevel } from '../image/decode';
import { carryMipChain, GODOT_DEFAULT_MIN_FILTER, type TextureLevel } from '../texelTexture';
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

/**
 * Null with no `image`, or one `decodeMipmappedImageRef` declines. The levels the Image stores are
 * the texture's chain as saved, which Godot uploads whole (`texture_storage.cpp:858`, `:875`).
 */
function build(
  properties: Record<string, string>,
  resources: readonly TscnInternalResource[]
): THREE.DataTexture | null {
  const pixels = decodeMipmappedImageRef(properties.image, resources);
  if (!pixels) return null;
  const { width, height } = pixels;
  // The decode owns its buffers, so the rows reverse where they lie, with no copy.
  reverseRowsInPlace(pixels.data, width, height);
  const texture = colourDataTexture(pixels.data, width, height, pixels.format);
  const base: TextureLevel = { data: texture.image.data as Uint8Array | Uint16Array, width, height };
  carryMipChain(texture, [base, ...pixels.levels.map(uploadedLevel)], GODOT_DEFAULT_MIN_FILTER);
  return texture;
}

/** `level` as a `DataTexture` uploads it: bottom-up, floats as half floats. */
function uploadedLevel({ data, width, height }: DecodedLevel): TextureLevel {
  reverseRowsInPlace(data, width, height);
  return { data: uploadedTexels(data), width, height };
}
