/**
 * Resolves an `ImageTexture` sub-resource, whose `image` holds its pixels inline
 * (`scene/resources/image_texture.cpp`), to a `THREE.DataTexture`. An ImageTexture at a file path
 * is the image slice's: this reads only the saved pixels.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { reversedRows } from '../../../utils/reversedRows';
import { colourDataTexture } from '../colourDataTexture';
import { uploadedTexels } from '../halfFloatTexels';
import { decodeImageRef, type DecodedLevel } from '../image/decode';
import { carryDefaultMipChain, type TextureLevel } from '../texelTexture';
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
 * Null with no `image`, or one `decodeImageRef` declines. The levels the Image stores are the
 * texture's chain as saved, which Godot uploads whole (`texture_storage.cpp:858`, `:875`).
 */
function build(
  properties: Record<string, string>,
  resources: readonly TscnInternalResource[]
): THREE.DataTexture | null {
  const pixels = decodeImageRef(properties.image, resources);
  if (!pixels) return null;
  const { width, height } = pixels;
  const texture = colourDataTexture(reversedRows(pixels.data, width, height), width, height, pixels.format);
  const base: TextureLevel = { data: texture.image.data as Uint8Array | Uint16Array, width, height };
  carryDefaultMipChain(texture, [base, ...pixels.levels.map(uploadedLevel)]);
  return texture;
}

/** `level` as a `DataTexture` uploads it: bottom-up, floats as half floats. */
function uploadedLevel({ data, width, height }: DecodedLevel): TextureLevel {
  return { data: uploadedTexels(reversedRows(data, width, height)), width, height };
}
