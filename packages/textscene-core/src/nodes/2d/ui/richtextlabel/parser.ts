/** RichTextLabel parser — Control + text + bbcode/fit-content flags. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { RichTextLabelProperties } from './types';
import { parseControl } from '../control/parser';
import { boolSlotValue, packedArrayBody, packedArrayForms } from '../../../../godot/index.js';
import { floatElements } from '../../../../resources/shapes/packedArray';

const PACKED_FLOAT32_ARRAY_FORMS = packedArrayForms('PackedFloat32Array');

/** `RichTextLabel.tab_stops` — a plain `PackedFloat32Array(...)` literal; anything else the lenient parser leaves undefined, matching Label's own `tab_stops` leniency. */
function parseTabStops(value: string | undefined): number[] | undefined {
  if (value === undefined) return undefined;
  const matched = packedArrayBody(PACKED_FLOAT32_ARRAY_FORMS, value);
  if (!matched || matched.body === '') return undefined;
  try {
    return matched.flat ? floatElements(matched.body, 'PackedFloat32Array', value) : undefined;
  } catch {
    return undefined;
  }
}

export function parseRichTextLabel(
  heading: ParsedHeading,
  properties: Record<string, string>
): RichTextLabelProperties {
  const result: RichTextLabelProperties = { ...parseControl(heading, properties) };
  if (properties.text !== undefined) result.text = unquoteString(properties.text);
  result.bbcodeEnabled = boolSlotValue(properties.bbcode_enabled) === true;
  result.fitContent = boolSlotValue(properties.fit_content) === true;
  result.autowrapMode = parseOptionalInt(properties.autowrap_mode);
  result.horizontalAlignment = parseOptionalInt(properties.horizontal_alignment);
  result.verticalAlignment = parseOptionalInt(properties.vertical_alignment);
  result.tabStopsPx = parseTabStops(properties.tab_stops);
  result.tabSize = parseOptionalInt(properties.tab_size);
  result.autowrapTrimFlags = parseOptionalInt(properties.autowrap_trim_flags, 'int64');
  return result;
}
