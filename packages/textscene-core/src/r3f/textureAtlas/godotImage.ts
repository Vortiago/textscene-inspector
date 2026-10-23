/** A held texture's pixels as Godot's image holds them: RGBA8 sRGB bytes, the top row first. */

import * as THREE from 'three';
import { readImagePixels } from '../../resources/formats/image/imagePixels.js';
import { isBottomUp, reversedRows } from '../../utils/reversedRows.js';

export interface GodotImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

/**
 * Each texture's last read, so an atlas rebuild reads again only a texture whose pixels changed:
 * a read of a decoded image is a GPU readback. Written only by `godotImage`, and collected with
 * its texture.
 */
const reads = new WeakMap<THREE.Texture, { version: number; image: GodotImage | undefined }>();

/** Undefined when `texture`'s pixels cannot be read, as before its image decodes. */
function godotImage(texture: THREE.Texture): GodotImage | undefined {
  const read = reads.get(texture);
  if (read?.version === texture.version) return read.image;
  const image = readGodotImage(texture);
  reads.set(texture, { version: texture.version, image });
  return image;
}

function readGodotImage(texture: THREE.Texture): GodotImage | undefined {
  if (!readsAsBytes(texture)) return undefined;
  const pixels = readImagePixels(texture.image);
  if (!pixels) return undefined;
  if (!isBottomUp(texture)) return pixels;
  return {
    width: pixels.width,
    height: pixels.height,
    data: reversedRows(pixels.data, pixels.width, pixels.height),
  };
}

/**
 * Whether `readImagePixels` gives `texture` as RGBA8 bytes: its own bytes, or half floats it clamps
 * to bytes. A float or a one- or two-channel array would copy into the atlas with the wrong stride.
 */
function readsAsBytes({ format, type }: THREE.Texture): boolean {
  return format === THREE.RGBAFormat && (type === THREE.UnsignedByteType || type === THREE.HalfFloatType);
}

/** The textures of `textures` whose pixels can be read, each with its image, in the order given. */
export function readableTextures(
  textures: readonly THREE.Texture[]
): { texture: THREE.Texture; image: GodotImage }[] {
  return textures.flatMap((texture) => {
    const image = godotImage(texture);
    return image ? [{ texture, image }] : [];
  });
}
