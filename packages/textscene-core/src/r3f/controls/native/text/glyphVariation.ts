/**
 * The outline changes Godot runs on a glyph slot for a `FontVariation`: `FT_Outline_Embolden` and
 * then the `variation_transform` through `FT_Outline_Transform` (`text_server_adv.cpp:1314-1320`
 * for the raster, `:3616-3624` for `font_get_glyph_contours`).
 */

import { emboldenOutline } from './ftEmbolden';
import {
  scaledOutlineContours,
  transformOutline,
  type GlyphContours,
  type ScaledOutline,
} from './glyphContours';

const UNIT_16_16 = 0x10000;

/** The face's `variation_embolden` and the shear of its `variation_transform`: absent is none. */
export interface GlyphVariation {
  embolden?: number;
  skew?: number;
}

/**
 * The contours of `outline` once the variation has changed it, in place. The shear matrix is the
 * float `skew` truncated to 16.16, as `FT_Fixed(float)` does, and it runs only for a transform that
 * is not the identity.
 */
export function variedContours(
  outline: ScaledOutline,
  { embolden = 0, skew = 0 }: GlyphVariation,
  fontSizePx: number
): GlyphContours {
  emboldenOutline(outline, embolden, fontSizePx);
  if (skew !== 0)
    transformOutline(outline, [UNIT_16_16, Math.trunc(Math.fround(skew) * UNIT_16_16), 0, UNIT_16_16]);
  return scaledOutlineContours(outline);
}
