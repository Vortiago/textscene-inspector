/** Parses a Label: the Control properties plus its text, alignment and reveal state. */

import { type ParsedHeading, unquoteString, unquoteStringName } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import { parseTextDirectionProperties } from '../../../../parser/textDirectionParser';
import { parseStructuredTextOverride } from '../../../../parser/structuredTextOverrideParser';
import type { LabelProperties } from './types';
import { resolveLabelVisibleChars } from '../shared/visibleChars';
import { parseControl } from '../control/parser';
import { boolSlotValue } from '../../../../godot/variant/variantBool.js';
import { packedArrayBody, packedArrayForms } from '../../../../godot/variant/variantParser.js';
import { floatElements } from '../../../../resources/shapes/packedArray';
import { SizeFlags } from '../../../../godot/scene/control';

const PACKED_FLOAT32_ARRAY_FORMS = packedArrayForms('PackedFloat32Array');

/** `Label.tab_stops`: a plain `PackedFloat32Array(...)` literal. The lenient parser leaves anything else undefined. */
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

/**
 * Godot's `Label` constructor calls `set_v_size_flags(SIZE_SHRINK_CENTER)`, so a Label in a box
 * container centres at its text height on the cross axis instead of filling it. Base `Control`
 * defaults to `SIZE_FILL`, so this applies only when the scene sets no `size_flags_vertical`.
 */
const LABEL_DEFAULT_V_SIZE_FLAGS = SizeFlags.SHRINK_CENTER;

export function parseLabel(heading: ParsedHeading, properties: Record<string, string>): LabelProperties {
  const result: LabelProperties = {
    ...parseControl(heading, properties),
    ...parseTextDirectionProperties(properties, 'Label'),
    ...parseStructuredTextOverride(properties),
  };
  if (result.sizeFlagsVertical === undefined) {
    result.sizeFlagsVertical = LABEL_DEFAULT_V_SIZE_FLAGS;
  }
  if (properties.text !== undefined) result.text = unquoteString(properties.text);
  result.horizontalAlignment = parseOptionalInt(properties.horizontal_alignment);
  result.verticalAlignment = parseOptionalInt(properties.vertical_alignment);
  result.autowrapMode = parseOptionalInt(properties.autowrap_mode);
  if (boolSlotValue(properties.uppercase) === true) result.uppercase = true;
  result.overrunBehavior = parseOptionalInt(properties.text_overrun_behavior);
  if (boolSlotValue(properties.clip_text) === true) result.clipText = true;
  // label.cpp:1259-1261: `set_ellipsis_char` keeps only the first character.
  if (properties.ellipsis_char !== undefined) {
    result.ellipsisChar = unquoteStringName(properties.ellipsis_char).slice(0, 1) || undefined;
  }
  // int64: a `BitField` slot, as the validator declares it. Otherwise a value past 2^31 reads as a
  // different number than Godot stores.
  result.justificationFlags = parseOptionalInt(properties.justification_flags, 'int64');
  result.tabStopsPx = parseTabStops(properties.tab_stops);
  result.autowrapTrimFlags = parseOptionalInt(properties.autowrap_trim_flags, 'int64');
  // label.cpp:1198-1205: assigned unconditionally. `c_unescape()` is not ported (comparison.md), so a
  // doubly-escaped literal (`"\\n"`) stays literal.
  if (properties.paragraph_separator !== undefined) {
    result.paragraphSeparator = unquoteString(properties.paragraph_separator);
  }
  result.linesSkipped = parseOptionalInt(properties.lines_skipped);
  result.maxLinesVisible = parseOptionalInt(properties.max_lines_visible);
  if (properties.label_settings !== undefined) result.labelSettings = properties.label_settings.trim();
  const visibleState = resolveLabelVisibleChars(properties, () => (result.text ?? '').length);
  if (visibleState) {
    result.visibleCharacters = visibleState.visibleChars;
    result.visibleRatio = visibleState.visibleRatio;
  }
  result.visibleCharactersBehavior = parseOptionalInt(properties.visible_characters_behavior);
  return result;
}
