/** TextureProgressBar parser — Control + Range bases plus TextureProgressBar's own members. */

import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalFloat, parseOptionalInt, parseOptionalVector2 } from '../../../../parser/valueParsers';
import { parseColorOrUndefined } from '../../../../utils/colorParser';
import { parseControl } from '../control/parser';
import { parseRange } from '../shared/range';
import type { TextureProgressBarProperties } from './types';

export function parseTextureProgressBar(
  heading: ParsedHeading,
  properties: Record<string, string>
): TextureProgressBarProperties {
  return {
    ...parseControl(heading, properties),
    // TextureProgressBar sets `step = 1.0` in its constructor — measured from the engine
    // (`ClassDB.class_get_property_default_value`, 4.6.3). `_calc_value` snaps
    // `value` to it, so an omitted key is NOT "no snap".
    ...parseRange(properties, { step: 1 }),
    fillMode: parseOptionalInt(properties.fill_mode),
    ninePatchStretch: parseOptionalBool(properties.nine_patch_stretch),
    radialCenterOffset: parseOptionalVector2(properties.radial_center_offset),
    radialFillDegrees: parseOptionalFloat(properties.radial_fill_degrees),
    radialInitialAngle: parseOptionalFloat(properties.radial_initial_angle),
    stretchMarginBottom: parseOptionalInt(properties.stretch_margin_bottom),
    stretchMarginLeft: parseOptionalInt(properties.stretch_margin_left),
    stretchMarginRight: parseOptionalInt(properties.stretch_margin_right),
    stretchMarginTop: parseOptionalInt(properties.stretch_margin_top),
    textureOver: properties.texture_over,
    textureProgress: properties.texture_progress,
    textureProgressOffset: parseOptionalVector2(properties.texture_progress_offset),
    textureUnder: properties.texture_under,
    tintOver: parseColorOrUndefined(properties.tint_over),
    tintProgress: parseColorOrUndefined(properties.tint_progress),
    tintUnder: parseColorOrUndefined(properties.tint_under),
  };
}
