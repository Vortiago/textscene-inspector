/**
 * NoiseTexture2D decode through the shared value decoders, with defaults from
 * `noise_texture_2d.h:47-62`. The `noise` and `color_ramp` refs stay raw, and
 * `resolveNoiseTexture.ts` resolves them against the owning file's table.
 */

import {
  boolOr,
  floatOr,
  settableFloatOr,
  settableIntOr,
  type SetterRange,
} from '../../../parser/valueParsers';
import type { NoiseTexture2DData } from './types';

/** `size = Size2i(512, 512)` (`noise_texture_2d.h:54`). */
const DEFAULT_SIZE = 512;

/** `set_width` and `set_height` refuse an axis below 1 (`noise_texture_2d.cpp:243`, `:252`). */
const SIZE_RANGE: SetterRange = { min: 1 };

/** `seamless_blend_skirt = 0.1` (`noise_texture_2d.h:59`). */
const DEFAULT_BLEND_SKIRT = 0.1;

/** `set_seamless_blend_skirt` refuses a skirt outside 0 to 1 (`noise_texture_2d.cpp:309`). */
const BLEND_SKIRT_RANGE: SetterRange = { min: 0, max: 1 };

export function decodeNoiseTexture2D(properties: Record<string, string>): NoiseTexture2DData {
  return {
    width: settableIntOr(properties.width, DEFAULT_SIZE, SIZE_RANGE, 'NoiseTexture2D width'),
    height: settableIntOr(properties.height, DEFAULT_SIZE, SIZE_RANGE, 'NoiseTexture2D height'),
    invert: boolOr(properties.invert, false, 'NoiseTexture2D invert'),
    normalize: boolOr(properties.normalize, true, 'NoiseTexture2D normalize'),
    seamless: boolOr(properties.seamless, false, 'NoiseTexture2D seamless'),
    seamlessBlendSkirt: settableFloatOr(
      properties.seamless_blend_skirt,
      DEFAULT_BLEND_SKIRT,
      BLEND_SKIRT_RANGE,
      'NoiseTexture2D seamless_blend_skirt'
    ),
    asNormalMap: boolOr(properties.as_normal_map, false, 'NoiseTexture2D as_normal_map'),
    bumpStrength: floatOr(properties.bump_strength, 8, 'NoiseTexture2D bump_strength'),
    noise: properties.noise ?? null,
    colorRamp: properties.color_ramp ?? null,
  };
}
