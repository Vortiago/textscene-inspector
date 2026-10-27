/**
 * TextMesh decode. Defaults: `primitive_meshes.h:581-600`. The setters raise `depth` to 0 and clamp
 * `font_size` to 1-127, `pixel_size` to 0.0001-128 and `curve_step` to 0.1-10 (`primitive_meshes.cpp:3811-3912`),
 * and refuse an alignment past 3 (`:3712-3733`). `text_direction`, `language` and the structured text
 * override stay unread: no right-to-left shaping exists here.
 */

import { unquoteString } from '../../../parser/utils';
import { boolOr, enumOr, floatOr, intOr, vec2Or } from '../../../parser/valueParsers';
import { clamp } from '../../../godot/math/math';
import { storedReal, storedVector2 } from '../../../godot/math/real';
import { HorizontalAlignment, VerticalAlignment } from '../../../godot/math/alignment';
import { AutowrapMode, DEFAULT_JUSTIFICATION_FLAGS } from '../../../godot/text/textServerEnums';
import type { TextMeshProperties } from './types';

const HORIZONTAL_ALIGNMENTS = Object.values(HorizontalAlignment);
const VERTICAL_ALIGNMENTS = Object.values(VerticalAlignment);

export function decodeTextMesh(properties: Record<string, string>): TextMeshProperties {
  return {
    text: properties.text === undefined ? '' : unquoteString(properties.text),
    fontSize: clamp(intOr(properties.font_size, 16, 'TextMesh font_size'), 1, 127),
    horizontalAlignment: enumOr(
      properties.horizontal_alignment,
      HorizontalAlignment.HORIZONTAL_ALIGNMENT_CENTER,
      HORIZONTAL_ALIGNMENTS,
      'TextMesh horizontal_alignment'
    ),
    verticalAlignment: enumOr(
      properties.vertical_alignment,
      VerticalAlignment.VERTICAL_ALIGNMENT_CENTER,
      VERTICAL_ALIGNMENTS,
      'TextMesh vertical_alignment'
    ),
    isUppercase: boolOr(properties.uppercase, false, 'TextMesh uppercase'),
    lineSpacing: storedReal(floatOr(properties.line_spacing, 0, 'TextMesh line_spacing')),
    autowrapMode: intOr(properties.autowrap_mode, AutowrapMode.AUTOWRAP_OFF, 'TextMesh autowrap_mode'),
    // A BitField, which Godot reads as 64 bits.
    justificationFlags: intOr(
      properties.justification_flags,
      DEFAULT_JUSTIFICATION_FLAGS,
      'TextMesh justification_flags',
      'int64'
    ),
    depth: storedReal(Math.max(floatOr(properties.depth, 0.05, 'TextMesh depth'), 0)),
    width: storedReal(floatOr(properties.width, 500, 'TextMesh width')),
    pixelSize: storedReal(clamp(floatOr(properties.pixel_size, 0.01, 'TextMesh pixel_size'), 0.0001, 128)),
    curveStep: storedReal(clamp(floatOr(properties.curve_step, 0.5, 'TextMesh curve_step'), 0.1, 10)),
    offset: storedVector2(vec2Or(properties.offset, { x: 0, y: 0 }, 'TextMesh offset')),
  };
}
