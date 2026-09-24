/** Parses a LineEdit: the Control base plus the text, placeholder and echo properties. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalFloat, parseOptionalInt } from '../../../../parser/valueParsers';
import { parseControl } from '../control/parser';
import type { LineEditProperties } from './types';

/** `unquoteString` on a present value, `undefined` on an absent one. */
function optionalString(value: string | undefined): string | undefined {
  return value === undefined ? undefined : unquoteString(value);
}

export function parseLineEdit(
  heading: ParsedHeading,
  properties: Record<string, string>
): LineEditProperties {
  const result: LineEditProperties = {
    ...parseControl(heading, properties),
    text: optionalString(properties.text),
    placeholderText: optionalString(properties.placeholder_text),
    alignment: parseOptionalInt(properties.alignment),
    editable: parseOptionalBool(properties.editable),
    secret: parseOptionalBool(properties.secret),
    secretCharacter: optionalString(properties.secret_character),
    flat: parseOptionalBool(properties.flat),
    maxLength: parseOptionalInt(properties.max_length),
    expandToTextLength: parseOptionalBool(properties.expand_to_text_length),
    clearButtonEnabled: parseOptionalBool(properties.clear_button_enabled),
    iconExpandMode: parseOptionalInt(properties.icon_expand_mode),
    rightIconScale: parseOptionalFloat(properties.right_icon_scale),
    caretForceDisplayed: parseOptionalBool(properties.caret_force_displayed),
    drawControlChars: parseOptionalBool(properties.draw_control_chars),
  };
  // `right_icon` stays a raw resource ref, not unquoted: the painter resolves it in the node's own scope.
  if (properties.right_icon !== undefined) result.rightIcon = properties.right_icon;
  return result;
}
