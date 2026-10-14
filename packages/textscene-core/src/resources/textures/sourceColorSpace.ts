/**
 * The Godot image format a producer builds a texture in, recorded on the texture, and the colour
 * space a `source_color` sampler reads that texture in.
 */

import * as THREE from 'three';
import { formatHasSrgbView } from '../../godot/index.js';

/** The `Image::format_names` entry. In `userData`, so every `clone()` carries it. */
const GODOT_FORMAT = 'textsceneGodotFormat';

/** Records on `texture` the format Godot holds its image in, and returns it. */
export function recordGodotFormat<T extends THREE.Texture>(texture: T, format: string): T {
  texture.userData[GODOT_FORMAT] = format;
  return texture;
}

/** Records on `target` the format recorded on `source`, for a texture cut from another. */
export function copyGodotFormat<T extends THREE.Texture>(target: T, source: THREE.Texture): T {
  const format: unknown = source.userData[GODOT_FORMAT];
  if (typeof format === 'string') recordGodotFormat(target, format);
  return target;
}

/**
 * The colour space a `source_color` sampler reads `texture` in: its sRGB view, or its raw view when
 * its format has none (`material_storage.cpp:1073`). A texture with no recorded format, an image
 * file, reads sRGB.
 */
export function sourceColorSpace(texture: THREE.Texture): THREE.ColorSpace {
  const format: unknown = texture.userData[GODOT_FORMAT];
  return typeof format !== 'string' || formatHasSrgbView(format) ? THREE.SRGBColorSpace : THREE.NoColorSpace;
}
