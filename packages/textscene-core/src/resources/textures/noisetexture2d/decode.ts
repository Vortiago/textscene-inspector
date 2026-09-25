/**
 * NoiseTexture2D decode through the shared value decoders, with defaults from
 * `noise_texture_2d.h:47-62`. The `noise` and `color_ramp` refs stay raw, and
 * `resolveNoiseTexture.ts` resolves them against the owning file's table.
 */

import { boolOr, floatOr, intOr } from '../../../parser/valueParsers';
import type { NoiseTexture2DData } from './types';

export function decodeNoiseTexture2D(properties: Record<string, string>): NoiseTexture2DData {
  return {
    width: intOr(properties.width, 512, 'NoiseTexture2D width'),
    height: intOr(properties.height, 512, 'NoiseTexture2D height'),
    invert: boolOr(properties.invert, false, 'NoiseTexture2D invert'),
    normalize: boolOr(properties.normalize, true, 'NoiseTexture2D normalize'),
    seamless: boolOr(properties.seamless, false, 'NoiseTexture2D seamless'),
    seamlessBlendSkirt: floatOr(properties.seamless_blend_skirt, 0.1, 'NoiseTexture2D seamless_blend_skirt'),
    asNormalMap: boolOr(properties.as_normal_map, false, 'NoiseTexture2D as_normal_map'),
    bumpStrength: floatOr(properties.bump_strength, 8, 'NoiseTexture2D bump_strength'),
    noise: properties.noise ?? null,
    colorRamp: properties.color_ramp ?? null,
  };
}
