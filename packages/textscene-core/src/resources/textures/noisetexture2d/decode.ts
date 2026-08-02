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

export function decodeNoiseTexture2D(properties: Record<string, unknown>): NoiseTexture2DData {
  const read = (key: string): string | undefined => {
    const value = properties[key];
    return typeof value === 'string' ? value : undefined;
  };

  return {
    width: intOr(read('width'), 512, 'NoiseTexture2D width'),
    height: intOr(read('height'), 512, 'NoiseTexture2D height'),
    invert: boolOr(read('invert'), false, 'NoiseTexture2D invert'),
    normalize: boolOr(read('normalize'), true, 'NoiseTexture2D normalize'),
    seamless: boolOr(read('seamless'), false, 'NoiseTexture2D seamless'),
    seamlessBlendSkirt: floatOr(read('seamless_blend_skirt'), 0.1, 'NoiseTexture2D seamless_blend_skirt'),
    asNormalMap: boolOr(read('as_normal_map'), false, 'NoiseTexture2D as_normal_map'),
    bumpStrength: floatOr(read('bump_strength'), 8, 'NoiseTexture2D bump_strength'),
    noise: read('noise') ?? null,
    colorRamp: read('color_ramp') ?? null,
  };
}
