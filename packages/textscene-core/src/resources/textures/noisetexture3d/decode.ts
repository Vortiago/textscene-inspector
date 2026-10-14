/**
 * NoiseTexture3D decode through the shared value decoders, with defaults from
 * `noise_texture_3d.h:52-58`. The `noise` and `color_ramp` refs stay raw, and
 * `resolveNoiseTexture.ts` resolves them against the owning file's table.
 */

import { boolOr, settableFloatOr, settableIntOr, type SetterRange } from '../../../parser/valueParsers';
import type { NoiseTexture3DData } from './types';

/** `width = 64`, `height = 64` and `depth = 64` (`noise_texture_3d.h:52-54`). */
const DEFAULT_SIZE = 64;

/** `set_width`, `set_height` and `set_depth` refuse an axis below 1 (`noise_texture_3d.cpp:236`, `:245`, `:254`). */
const SIZE_RANGE: SetterRange = { min: 1 };

/** `seamless_blend_skirt = 0.1` (`noise_texture_3d.h:57`). */
const DEFAULT_BLEND_SKIRT = 0.1;

/** `set_seamless_blend_skirt` refuses a skirt outside 0.05 to 1 (`noise_texture_3d.cpp:288`). */
const BLEND_SKIRT_RANGE: SetterRange = { min: 0.05, max: 1 };

export function decodeNoiseTexture3D(properties: Record<string, string>): NoiseTexture3DData {
  return {
    width: settableIntOr(properties.width, DEFAULT_SIZE, SIZE_RANGE, 'NoiseTexture3D width'),
    height: settableIntOr(properties.height, DEFAULT_SIZE, SIZE_RANGE, 'NoiseTexture3D height'),
    depth: settableIntOr(properties.depth, DEFAULT_SIZE, SIZE_RANGE, 'NoiseTexture3D depth'),
    invert: boolOr(properties.invert, false, 'NoiseTexture3D invert'),
    normalize: boolOr(properties.normalize, true, 'NoiseTexture3D normalize'),
    seamless: boolOr(properties.seamless, false, 'NoiseTexture3D seamless'),
    seamlessBlendSkirt: settableFloatOr(
      properties.seamless_blend_skirt,
      DEFAULT_BLEND_SKIRT,
      BLEND_SKIRT_RANGE,
      'NoiseTexture3D seamless_blend_skirt'
    ),
    noise: properties.noise ?? null,
    colorRamp: properties.color_ramp ?? null,
  };
}
