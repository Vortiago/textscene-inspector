/** Label3D parser: the Node3D surface plus the label's own properties. */

import { type ParsedHeading, unquoteString } from '../../../parser/utils';
import type { Label3DProperties } from './types';
import { AlphaCutMode, BillboardMode, TextureFilter } from './types';
import { parseGeometryInstance3D } from '../geometryinstance3d/parser';
import { parseColor, colorOr } from '../../../utils/colorParser';
import { enumOr, floatOr, intOr, parseOptionalInt } from '../../../parser/valueParsers';
import { ShadowCastingSetting } from '../../../godot/rendering/rendering';
import { boolSlotValue } from '../../../godot/variant/variantBool.js';
import {
  HORIZONTAL_ALIGNMENT_CENTER,
  HORIZONTAL_ALIGNMENT_FILL,
  HORIZONTAL_ALIGNMENT_LEFT,
  type HorizontalAlignment,
} from '../../../godot/math/math';

export function parseLabel3D(heading: ParsedHeading, properties: Record<string, string>): Label3DProperties {
  const baseProps = parseGeometryInstance3D(heading, properties);

  return {
    ...baseProps,
    // The constructor turns shadows off (`label_3d.cpp:1090`), so the file omits an OFF.
    castShadow: parseOptionalInt(properties.cast_shadow) ?? ShadowCastingSetting.OFF,
    text: properties.text === undefined ? '' : unquoteString(properties.text),
    pixel_size: floatOr(properties.pixel_size, 0.005, 'pixel_size'),
    // The setter refuses an index outside 0-2, PARTICLES included (`label_3d.cpp:1001`), so the
    // label keeps its DISABLED default.
    billboard: enumOr(
      properties.billboard,
      BillboardMode.BILLBOARD_DISABLED,
      [BillboardMode.BILLBOARD_DISABLED, BillboardMode.BILLBOARD_ENABLED, BillboardMode.BILLBOARD_FIXED_Y],
      'billboard'
    ),
    modulate: parseColor(properties.modulate),
    // `intOr`, not `floatOr`: label_3d.cpp declares both sizes Variant::INT with
    // an `int` setter, so Godot truncates the fraction, and the renderer sizes
    // the quad by the number the engine holds.
    outline_size: intOr(properties.outline_size, 12, 'outline_size'),
    outline_modulate: colorOr(properties.outline_modulate, { r: 0, g: 0, b: 0, a: 1 }),
    double_sided: boolSlotValue(properties.double_sided) !== false, // Godot default true
    font_size: intOr(properties.font_size, 32, 'font_size'),
    line_spacing: floatOr(properties.line_spacing, 0, 'line_spacing'),
    horizontal_alignment: parseHorizontalAlignment(properties.horizontal_alignment),
    no_depth_test: boolSlotValue(properties.no_depth_test) === true,
    render_priority: intOr(properties.render_priority, 0, 'render_priority'),
    outline_render_priority: intOr(properties.outline_render_priority, -1, 'outline_render_priority'),
    alpha_cut: parseAlphaCutMode(properties.alpha_cut),
    alpha_scissor_threshold: floatOr(properties.alpha_scissor_threshold, 0.5, 'alpha_scissor_threshold'),
    alpha_hash_scale: floatOr(properties.alpha_hash_scale, 1, 'alpha_hash_scale'),
    // `set_alpha_antialiasing` stores any value (`label_3d.cpp:1058-1063`), and any but OFF ramps the edge.
    alpha_antialiasing_mode: intOr(properties.alpha_antialiasing_mode, 0, 'alpha_antialiasing_mode'),
    alpha_antialiasing_edge: floatOr(properties.alpha_antialiasing_edge, 0, 'alpha_antialiasing_edge'),
    fixed_size: boolSlotValue(properties.fixed_size) === true,
    texture_filter: parseTextureFilter(properties.texture_filter),
  };
}

function parseAlphaCutMode(value: string | undefined): AlphaCutMode {
  const num = intOr(value, AlphaCutMode.DISABLED, 'alpha_cut');
  return num >= AlphaCutMode.DISABLED && num <= AlphaCutMode.HASH
    ? (num as AlphaCutMode)
    : AlphaCutMode.DISABLED;
}

function parseTextureFilter(value: string | undefined): TextureFilter {
  const num = intOr(value, TextureFilter.LINEAR_WITH_MIPMAPS, 'texture_filter');
  return num >= TextureFilter.NEAREST && num <= TextureFilter.LINEAR_WITH_MIPMAPS_ANISOTROPIC
    ? (num as TextureFilter)
    : TextureFilter.LINEAR_WITH_MIPMAPS;
}

function parseHorizontalAlignment(value: string | undefined): HorizontalAlignment {
  const num = intOr(value, HORIZONTAL_ALIGNMENT_CENTER, 'horizontal_alignment');
  return num >= HORIZONTAL_ALIGNMENT_LEFT && num <= HORIZONTAL_ALIGNMENT_FILL
    ? (num as HorizontalAlignment)
    : HORIZONTAL_ALIGNMENT_CENTER;
}
