/**
 * NoiseTexture2D decode through the shared value decoders, with defaults from
 * `noise_texture_2d.h:47-62`. The `noise` and `color_ramp` refs stay raw, and
 * `resolveNoiseTexture.ts` resolves them against the owning file's table.
 */

import { warn } from '../../../logger.js';
import { boolOr, floatOr, intOr } from '../../../parser/valueParsers';
import type { NoiseTexture2DData } from './types';

/** `size = Size2i(512, 512)` (`noise_texture_2d.h:54`). */
const DEFAULT_SIZE = 512;

/** `seamless_blend_skirt = 0.1` (`noise_texture_2d.h:59`). */
const DEFAULT_BLEND_SKIRT = 0.1;

export function decodeNoiseTexture2D(properties: Record<string, string>): NoiseTexture2DData {
  return {
    width: sizeAxis(properties.width, 'NoiseTexture2D width'),
    height: sizeAxis(properties.height, 'NoiseTexture2D height'),
    invert: boolOr(properties.invert, false, 'NoiseTexture2D invert'),
    normalize: boolOr(properties.normalize, true, 'NoiseTexture2D normalize'),
    seamless: boolOr(properties.seamless, false, 'NoiseTexture2D seamless'),
    seamlessBlendSkirt: blendSkirt(properties.seamless_blend_skirt),
    asNormalMap: boolOr(properties.as_normal_map, false, 'NoiseTexture2D as_normal_map'),
    bumpStrength: floatOr(properties.bump_strength, 8, 'NoiseTexture2D bump_strength'),
    noise: properties.noise ?? null,
    colorRamp: properties.color_ramp ?? null,
  };
}

/**
 * `set_width` and `set_height` refuse an axis below 1 (`noise_texture_2d.cpp:243`, `:252`),
 * and a refused write leaves the default in place.
 */
function sizeAxis(raw: string | undefined, context: string): number {
  const value = intOr(raw, DEFAULT_SIZE, context);
  return value >= 1 ? value : refused(context, value, DEFAULT_SIZE);
}

/** `set_seamless_blend_skirt` refuses a skirt outside 0 to 1 (`noise_texture_2d.cpp:309`). */
function blendSkirt(raw: string | undefined): number {
  const context = 'NoiseTexture2D seamless_blend_skirt';
  const value = floatOr(raw, DEFAULT_BLEND_SKIRT, context);
  return value < 0 || value > 1 ? refused(context, value, DEFAULT_BLEND_SKIRT) : value;
}

function refused(context: string, value: number, fallback: number): number {
  warn(`${context}: Godot's setter refuses ${value}, keeping the default ${fallback}`);
  return fallback;
}
