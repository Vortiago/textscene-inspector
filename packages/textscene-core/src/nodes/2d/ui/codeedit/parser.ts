/**
 * CodeEdit parser — TextEdit's own parse plus the gutter/indent members this
 * slice draws (or, for `line_folding`/`indent_size`, parses but cannot act
 * on — see `types.ts`'s own doc for each).
 */

import { type ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import { ruleInt } from '../../../../godot/int.js';
import { arrayBody, INT_ARRAY_FORMS, parsePackedStringArray } from './arrayForms.js';
import { parseTextEdit } from '../textedit/parser';
import type { CodeEditProperties } from './types';

/** The three spellings an int-array slot accepts (`arrayForms.ts`), narrowed to the numbers `_draw_guidelines` indexes. */
function parseIntArray(value: string | undefined): number[] | undefined {
  if (value === undefined) return undefined;
  const body = arrayBody(value, INT_ARRAY_FORMS);
  if (body === undefined) return undefined;
  return body
    .split(',')
    .map((element) => element.trim())
    .filter((element) => element.length > 0)
    .map((element) => ruleInt(element) ?? 0);
}

/** The three spellings a String-array slot accepts (`arrayForms.ts`); an unreadable value reads as absent, which is the class default. */
function parseStringArray(value: string | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  return parsePackedStringArray(value) ?? undefined;
}

export function parseCodeEdit(
  heading: ParsedHeading,
  properties: Record<string, string>
): CodeEditProperties {
  return {
    ...parseTextEdit(heading, properties),
    gutterDrawLineNumbers: parseOptionalBool(properties.gutters_draw_line_numbers),
    gutterZeroPadLineNumbers: parseOptionalBool(properties.gutters_zero_pad_line_numbers),
    gutterLineNumbersMinDigits: parseOptionalInt(properties.gutters_line_numbers_min_digits),
    gutterDrawBookmarks: parseOptionalBool(properties.gutters_draw_bookmarks),
    gutterDrawBreakpoints: parseOptionalBool(properties.gutters_draw_breakpoints_gutter),
    gutterDrawExecutingLines: parseOptionalBool(properties.gutters_draw_executing_lines),
    gutterDrawFoldGutter: parseOptionalBool(properties.gutters_draw_fold_gutter),
    lineFolding: parseOptionalBool(properties.line_folding),
    indentSize: parseOptionalInt(properties.indent_size),
    lineLengthGuidelines: parseIntArray(properties['line_length_guidelines']),
    delimiterComments: parseStringArray(properties['delimiter_comments']),
    delimiterStrings: parseStringArray(properties['delimiter_strings']),
  };
}
