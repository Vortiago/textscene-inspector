/** LineEdit parser — Control base + the text/placeholder/echo properties. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
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
  return {
    ...parseControl(heading, properties),
    text: optionalString(properties.text),
    placeholderText: optionalString(properties.placeholder_text),
    alignment: parseOptionalInt(properties.alignment),
    editable: parseOptionalBool(properties.editable),
    secret: parseOptionalBool(properties.secret),
    secretCharacter: optionalString(properties.secret_character),
    flat: parseOptionalBool(properties.flat),
  };
}
