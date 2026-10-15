/**
 * The two ways a grayscale noise field becomes RGBA: through a `color_ramp`, or
 * straight across.
 */

import type { Gradient } from '../../textures/gradienttexture2d/types';
import { sampleGradientColor } from '../../textures/gradienttexture2d/sample';
import { clamp8 } from './noiseBytes.js';

/**
 * `_modulate_with_gradient` of `NoiseTexture2D` and `NoiseTexture3D` (noise_texture_2d.cpp:183-198,
 * noise_texture_3d.cpp:175-189): each pixel's luminance is its ramp offset, and the ramp's colour
 * lands in an RGBA8 image.
 */
export function modulateWithGradient(gray: Uint8Array, gradient: Gradient): Uint8Array {
  const lut = rampLut(gradient);
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

/** The red channel of `modulateWithGradient`, without the other three. */
export function modulateRedWithGradient(gray: Uint8Array, gradient: Gradient): Uint8Array {
  const lut = rampLut(gradient);
  return gray.map((byte) => lut[byte * 4]!);
}

/**
 * The ramp's RGBA8 colour for each of the 256 bytes a pixel can hold, so the ramp is evaluated
 * once per value, not per pixel with a binary search and an allocation each.
 */
function rampLut(gradient: Gradient): Uint8Array {
  const lut = new Uint8Array(256 * 4);
  for (let v = 0; v < 256; v++) {
    const color = sampleGradientColor(gradient, grayLuminance(v));
    lut[v * 4] = rgba8Channel(color.r);
    lut[v * 4 + 1] = rgba8Channel(color.g);
    lut[v * 4 + 2] = rgba8Channel(color.b);
    lut[v * 4 + 3] = rgba8Channel(color.a);
  }
  return lut;
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

const f = Math.fround;

/**
 * `Color::get_luminance` (color.h:106-108) of an L8 pixel, in Godot's float arithmetic. Its weights
 * sum to 1 only in exact arithmetic, so some bytes land just under their own value.
 */
function grayLuminance(byte: number): number {
  const l = f(byte / 255);
  return f(f(f(f(0.2126) * l) + f(f(0.7152) * l)) + f(f(0.0722) * l));
}

/** An RGBA8 image truncates each channel as it stores it (`image.cpp:3577-3580`). */
function rgba8Channel(channel: number): number {
  return clamp8(channel * 255);
}
