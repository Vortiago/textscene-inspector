/** Label3D parser: the Node3D surface plus the label's own properties. */

import { type ParsedHeading, unquoteString } from '../../../parser/utils';
import type { Label3DProperties } from './types';
import { parseGeometryInstance3D } from '../geometryinstance3d/parser';
import { parseColor, colorOr } from '../../../utils/colorParser';
import { parseMaterialFor2dFields } from '../../../parser/materialFor2dParser';
import { enumOr, floatOr, intOr, parseOptionalInt } from '../../../parser/valueParsers';
import { ShadowCastingSetting } from '../../../godot/rendering/rendering';
import { HORIZONTAL_ALIGNMENT_CENTER, HORIZONTAL_ALIGNMENTS } from '../../../godot/math/alignment';
import { BillboardMode } from '../../../godot/rendering/materials/billboardMode';

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
    font_size: intOr(properties.font_size, 32, 'font_size'),
    line_spacing: floatOr(properties.line_spacing, 0, 'line_spacing'),
    // The setter refuses an index outside 0-3 (`label_3d.cpp:678`), so the label keeps CENTER.
    horizontal_alignment: enumOr(
      properties.horizontal_alignment,
      HORIZONTAL_ALIGNMENT_CENTER,
      HORIZONTAL_ALIGNMENTS,
      'horizontal_alignment'
    ),
    render_priority: intOr(properties.render_priority, 0, 'render_priority'),
    outline_render_priority: intOr(properties.outline_render_priority, -1, 'outline_render_priority'),
    ...parseMaterialFor2dFields(properties, 'Label3D'),
  };
}
