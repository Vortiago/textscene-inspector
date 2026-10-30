/**
 * The Godot image format a producer builds a texture in, recorded on the texture, and the colour
 * space a `source_color` sampler reads that texture in.
 */

import * as THREE from 'three';
import { formatHasSrgbView } from '../../godot/rendering/srgbView.js';
import { pinNoColorSpace } from './textureView';

/** The `Image::format_names` entry. In `userData`, so every `clone()` carries it. */
const GODOT_FORMAT = 'textsceneGodotFormat';

/**
 * Records on `texture` the format Godot holds its image in, and returns it. A format with no sRGB
 * view is pinned `NoColorSpace`, as a colour slot reads it, so binding one there shares the texture
 * and R3F's sRGB retag of a colour map cannot reach it.
 */
export function recordGodotFormat<T extends THREE.Texture>(texture: T, format: string): T {
  texture.userData[GODOT_FORMAT] = format;
  if (!formatHasSrgbView(format)) pinNoColorSpace(texture);
  return texture;
}

/** Records on `target` the format recorded on `source`, for a texture cut from another. */
export function copyGodotFormat<T extends THREE.Texture>(target: T, source: THREE.Texture): T {
  const format = recordedGodotFormat(source);
  return format === undefined ? target : recordGodotFormat(target, format);
}

/**
 * The colour space a `source_color` sampler reads `texture` in: its sRGB view, or its raw view when
 * its format has none (`material_storage.cpp:1073`). A texture with no recorded format, an image
 * whose headers name none, reads sRGB.
 */
export function sourceColorSpace(texture: THREE.Texture): THREE.ColorSpace {
  const format = recordedGodotFormat(texture);
  return format === undefined || formatHasSrgbView(format) ? THREE.SRGBColorSpace : THREE.NoColorSpace;
}

function recordedGodotFormat(texture: THREE.Texture): string | undefined {
  const format: unknown = texture.userData[GODOT_FORMAT];
  return typeof format === 'string' ? format : undefined;
}
