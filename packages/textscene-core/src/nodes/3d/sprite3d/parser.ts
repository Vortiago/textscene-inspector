/**
 * Sprite3D parser — parses Sprite3D TSCN properties into a typed shape.
 *
 * Property surface matches the linter's strict validators (15 fields)
 * plus inherited Node3D transform. Defaults follow Godot's:
 *   - billboard = 0 (DISABLED) — matching Label3D (see label3d/types.ts
 *     for the rationale).
 *   - hframes = vframes = 1, frame = 0.
 *   - pixel_size = 0.01.
 *   - modulate = white opaque.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import { parseColor } from '../../../utils/colorParser';
import {
  boolOr,
  enumOr,
  floatOr,
  intOr,
  parseOptionalRect2,
  parseOptionalVector2i,
  vec2Or,
} from '../../../parser/valueParsers';
import { AlphaCutMode, AxisMode, BillboardMode, type Sprite3DProperties } from './types';

export function parseSprite3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Sprite3DProperties {
  const baseProps = parseNode3D(heading, properties);

  const result: Sprite3DProperties = {
    ...baseProps,
    billboard: enumOr(properties.billboard, BillboardMode.BILLBOARD_DISABLED, [
      BillboardMode.BILLBOARD_DISABLED,
      BillboardMode.BILLBOARD_ENABLED,
      BillboardMode.BILLBOARD_FIXED_Y,
      BillboardMode.BILLBOARD_PARTICLES,
    ]),
    alpha_cut: enumOr(properties.alpha_cut, AlphaCutMode.ALPHA_CUT_DISABLED, [
      AlphaCutMode.ALPHA_CUT_DISABLED,
      AlphaCutMode.ALPHA_CUT_DISCARD,
      AlphaCutMode.ALPHA_CUT_OPAQUE_PREPASS,
    ]),
    axis: enumOr(properties.axis, AxisMode.AXIS_Y, [
      AxisMode.AXIS_X,
      AxisMode.AXIS_Y,
      AxisMode.AXIS_Z,
    ]),
    pixel_size: floatOr(properties.pixel_size, 0.01),
    transparency: floatOr(properties.transparency, 0),
    hframes: intOr(properties.hframes, 1),
    vframes: intOr(properties.vframes, 1),
    frame: intOr(properties.frame, 0),
    offset: vec2Or(properties.offset, { x: 0, y: 0 }, 'Sprite3D'),
    centered: boolOr(properties.centered, true),
    flip_h: boolOr(properties.flip_h, false),
    flip_v: boolOr(properties.flip_v, false),
    double_sided: boolOr(properties.double_sided, true),
    transparent: boolOr(properties.transparent, true),
    region_enabled: boolOr(properties.region_enabled, false),
    modulate: properties.modulate ? parseColor(properties.modulate) : { r: 1, g: 1, b: 1, a: 1 },
    render_priority: intOr(properties.render_priority, 0),
  };

  if (properties.texture) {
    result.texture = properties.texture;
  }

  if (properties.frame_coords) {
    const coords = parseOptionalVector2i(properties.frame_coords, 'Sprite3D frame_coords');
    if (coords) result.frame_coords = coords;
  }

  if (properties.region_rect) {
    const rect = parseOptionalRect2(properties.region_rect, 'Sprite3D region_rect');
    if (rect) result.region_rect = rect;
  }

  return result;
}
