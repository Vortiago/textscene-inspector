/** A held texture's pixels as Godot's image holds them: RGBA8 sRGB bytes, the top row first. */

import type * as THREE from 'three';
import { readImagePixels } from '../../resources/formats/image/imagePixels.js';
import { isBottomUp, reversedRows } from '../../utils/reversedRows.js';

export interface GodotImage {
  width: number;
  height: number;
  data: Uint8Array | Uint8ClampedArray;
}

/** Undefined when `texture`'s pixels cannot be read, as before its image decodes. */
export function godotImage(texture: THREE.Texture): GodotImage | undefined {
  const pixels = readImagePixels(texture.image);
  if (!pixels) return undefined;
  if (!isBottomUp(texture)) return pixels;
  return {
    width: pixels.width,
    height: pixels.height,
    data: reversedRows(pixels.data, pixels.width, pixels.height),
  };
}
