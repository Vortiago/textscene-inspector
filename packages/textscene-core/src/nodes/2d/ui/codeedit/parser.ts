/**
 * CodeEdit parser — TextEdit's own parse plus the gutter/indent members this
 * slice draws (or, for `line_folding`/`indent_size`, parses but cannot act
 * on — see `types.ts`'s own doc for each).
 */

import { type ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import { parseTextEdit } from '../textedit/parser';
import type { CodeEditProperties } from './types';

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
  };
}
