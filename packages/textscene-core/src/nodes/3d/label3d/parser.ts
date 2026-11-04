/** Label3D parser: the Node3D surface plus the label's own properties. */

import { type ParsedHeading, unquoteString } from '../../../parser/utils';
import type { Label3DProperties } from './types';
import { parseGeometryInstance3D } from '../geometryinstance3d/parser';
import { parseColor, colorOr } from '../../../utils/colorParser';
import { parseMaterialFor2dFields } from '../../../parser/materialFor2dParser';
import { boolOr, enumOr, floatOr, intOr, parseOptionalInt, vec2Or } from '../../../parser/valueParsers';
import { ShadowCastingSetting } from '../../../godot/rendering/rendering';
import { HorizontalAlignment, VerticalAlignment } from '../../../godot/math/alignment';
import {
  AutowrapMode,
  BREAK_TRIM_MASK,
  DEFAULT_AUTOWRAP_TRIM_FLAGS,
  DEFAULT_JUSTIFICATION_FLAGS,
} from '../../../godot/text/textServerEnums';
import { BillboardMode } from '../../../godot/rendering/materials/billboardMode';

const HORIZONTAL_ALIGNMENTS = Object.values(HorizontalAlignment);
const AUTOWRAP_MODES = Object.values(AutowrapMode);
const VERTICAL_ALIGNMENTS = Object.values(VerticalAlignment);

export function parseLabel3D(heading: ParsedHeading, properties: Record<string, string>): Label3DProperties {
  const baseProps = parseGeometryInstance3D(heading, properties);

  return {
    ...baseProps,
    // The constructor turns shadows off (`label_3d.cpp:1090`), so the file omits an OFF.
    castShadow: parseOptionalInt(properties.cast_shadow) ?? ShadowCastingSetting.OFF,
    text: properties.text === undefined ? '' : unquoteString(properties.text),
    font: properties.font,
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
      HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER,
      HORIZONTAL_ALIGNMENTS,
      'horizontal_alignment'
    ),
    // The setter refuses an index outside 0-3 (`label_3d.cpp:693`); FILL loads and acts as TOP.
    vertical_alignment: enumOr(
      properties.vertical_alignment,
      VerticalAlignment.VERTICAL_ALIGNMENT_CENTER,
      VERTICAL_ALIGNMENTS,
      'vertical_alignment'
    ),
    uppercase: boolOr(properties.uppercase, false, 'uppercase'),
    width: floatOr(properties.width, 500, 'width'),
    autowrap_mode: enumOr(
      properties.autowrap_mode,
      AutowrapMode.AUTOWRAP_OFF,
      AUTOWRAP_MODES,
      'autowrap_mode'
    ),
    // The BitField reads 64 bits, and the setter keeps `p_flags & BREAK_TRIM_MASK` (`label_3d.cpp:920`).
    autowrap_trim_flags:
      intOr(properties.autowrap_trim_flags, DEFAULT_AUTOWRAP_TRIM_FLAGS, 'autowrap_trim_flags', 'int64') &
      BREAK_TRIM_MASK,
    justification_flags: intOr(
      properties.justification_flags,
      DEFAULT_JUSTIFICATION_FLAGS,
      'justification_flags',
      'int64'
    ),
    offset: vec2Or(properties.offset, { x: 0, y: 0 }, 'offset'),
    render_priority: intOr(properties.render_priority, 0, 'render_priority'),
    outline_render_priority: intOr(properties.outline_render_priority, -1, 'outline_render_priority'),
    ...parseMaterialFor2dFields(properties, 'Label3D'),
  };
}
