/**
 * Builds the `THREE.DataTexture` of an `ImageTexture` from the Image its `image` names
 * (`scene/resources/image_texture.cpp`). An image file is the image slice's: this reads only
 * the pixels an Image resource saves.
 */

import type * as THREE from 'three';
import { reverseRowsInPlace } from '../../../utils/reversedRows';
import { colourDataTexture } from '../colourDataTexture';
import { uploadedTexels } from '../halfFloatTexels';
import { decodeMipmappedImage, type DecodedLevel } from '../image/decode';
import type { SavedImage } from '../image/kind';
import { carryMipChain, GODOT_DEFAULT_MIN_FILTER, type TextureLevel } from '../texelTexture';
import { rasterizedTexture, type ProceduralTextureResolution } from '../rasterizedTexture';

export function imageTexture(image: SavedImage): ProceduralTextureResolution<THREE.DataTexture> | null {
  return rasterizedTexture(image, 'ImageTexture', () => build(image));
}

/**
 * Null for an image `decodeMipmappedImage` declines. The levels the Image stores are
 * the texture's chain as saved, which Godot uploads whole (`texture_storage.cpp:858`, `:875`).
 */
function build(image: SavedImage): THREE.DataTexture | null {
  const pixels = decodeMipmappedImage(image);
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
