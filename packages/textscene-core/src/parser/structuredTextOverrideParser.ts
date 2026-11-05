/**
 * Parses `structured_text_bidi_override` and its options, which Label, LineEdit, TextEdit,
 * RichTextLabel, LinkButton, Label3D and TextMesh have.
 */

import { unquoteString } from './utils';
import { parseOptionalInt } from './valueParsers';
import { JACKETED_STRING_RE, arrayLiteralBody } from '../godot/variant/variantParser.js';
import { dropTrailingComma, splitTopLevel } from '../godot/string/string.js';
import { StructuredTextParser } from '../godot/text/textServerEnums';
import type { StructuredTextOverrideProperties } from '../godot/text/paragraphDirection';

/**
 * `structured_text_bidi_override_options`, which Godot writes as a bare `[…]`. A String or StringName
 * element is a string to `is_string()` (`text_server.cpp:2192`). Any other element keeps its place as null.
 */
function parseStructuredTextOptions(value: string | undefined): (string | null)[] {
  const body = value === undefined ? null : arrayLiteralBody(value);
  if (body === null) return [];
  return dropTrailingComma(splitTopLevel(body)).map((element) => {
    const trimmed = element.trim();
    return JACKETED_STRING_RE.test(trimmed) ? unquoteString(trimmed) : null;
  });
}

export function parseStructuredTextOverride(
  properties: Record<string, string>
): StructuredTextOverrideProperties {
  return {
    structuredTextBidiOverride:
      parseOptionalInt(properties.structured_text_bidi_override) ??
      StructuredTextParser.STRUCTURED_TEXT_DEFAULT,
    structuredTextBidiOverrideOptions: parseStructuredTextOptions(
      properties.structured_text_bidi_override_options
    ),
  };
}
