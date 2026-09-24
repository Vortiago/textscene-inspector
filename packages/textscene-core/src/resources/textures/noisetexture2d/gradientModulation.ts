/**
 * The two ways a grayscale noise field becomes RGBA: through a `color_ramp`, or
 * straight across.
 */

import { channelToByte } from '../../../utils/colorSpace';
import type { Gradient } from '../gradienttexture2d/types';
import { sampleGradientColor } from '../gradienttexture2d/sample';

/**
 * `NoiseTexture2D::_modulate_with_gradient` (noise_texture_2d.cpp:183-198): each
 * pixel's luminance is its ramp offset. Godot's weights sum to 1, so a grayscale
 * byte maps straight to the 0..1 offset.
 */
export function modulateWithGradient(gray: Uint8Array, gradient: Gradient): Uint8Array {
  // The offset is a byte / 255, 256 values, so the ramp is evaluated once per
  // value, not per pixel with a binary search and an allocation each.
  const lut = new Uint8Array(256 * 4);
  for (let v = 0; v < 256; v++) {
    const color = sampleGradientColor(gradient, v / 255);
    lut[v * 4] = channelToByte(color.r);
    lut[v * 4 + 1] = channelToByte(color.g);
    lut[v * 4 + 2] = channelToByte(color.b);
    lut[v * 4 + 3] = channelToByte(color.a);
  }

  const rgba = new Uint8Array(gray.length * 4);
  for (let i = 0; i < gray.length; i++) {
    const entry = gray[i]! * 4;
    rgba[i * 4] = lut[entry]!;
    rgba[i * 4 + 1] = lut[entry + 1]!;
    rgba[i * 4 + 2] = lut[entry + 2]!;
    rgba[i * 4 + 3] = lut[entry + 3]!;
  }
  return rgba;
}

/** A grayscale field as opaque RGBA, for the path with no `color_ramp`. */
export function grayToRgba(gray: Uint8Array): Uint8Array {
  const rgba = new Uint8Array(gray.length * 4);
  for (let i = 0; i < gray.length; i++) {
    rgba[i * 4] = gray[i]!;
    rgba[i * 4 + 1] = gray[i]!;
    rgba[i * 4 + 2] = gray[i]!;
    rgba[i * 4 + 3] = 255;
  }
  return rgba;
}
