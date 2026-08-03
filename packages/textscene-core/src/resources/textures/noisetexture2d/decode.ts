/**
 * NoiseTexture2D decode — the texture's own properties, through the shared
 * value decoders. The `noise` and `color_ramp` references stay raw (the leaf
 * rule the AtlasTexture slice follows); `resolveNoiseTexture.ts` resolves them
 * against the owning file's table.
 *
 * Defaults: `noise_texture_2d.h:47-62`.
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
