/**
 * Parses a TextEdit: the Control base plus the members `nativeSolver.ts` and `Component.tsx`
 * draw. `scroll_horizontal`/`scroll_vertical` are not read: the first draw's
 * `adjust_viewport_to_caret()` (`text_edit.cpp:905-909`) snaps them back to caret 0 at (0, 0).
 */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import { parseControl } from '../control/parser';
import type { TextEditProperties } from './types';

/** `unquoteString` on a present value, `undefined` on an absent one. */
function optionalString(value: string | undefined): string | undefined {
  return value === undefined ? undefined : unquoteString(value);
}

export function parseTextEdit(
  heading: ParsedHeading,
  properties: Record<string, string>
): TextEditProperties {
  return {
    ...parseControl(heading, properties),
    text: optionalString(properties.text),
    placeholderText: optionalString(properties.placeholder_text),
    editable: parseOptionalBool(properties.editable),
    wrapMode: parseOptionalInt(properties.wrap_mode),
    autowrapMode: parseOptionalInt(properties.autowrap_mode),
    drawTabs: parseOptionalBool(properties.draw_tabs),
    drawSpaces: parseOptionalBool(properties.draw_spaces),
    drawControlChars: parseOptionalBool(properties.draw_control_chars),
    highlightCurrentLine: parseOptionalBool(properties.highlight_current_line),
    caretDrawWhenEditableDisabled: parseOptionalBool(properties.caret_draw_when_editable_disabled),
    indentWrappedLines: parseOptionalBool(properties.indent_wrapped_lines),
    fitContentWidth: parseOptionalBool(properties.scroll_fit_content_width),
    fitContentHeight: parseOptionalBool(properties.scroll_fit_content_height),
    minimapDraw: parseOptionalBool(properties.minimap_draw),
    minimapWidth: parseOptionalInt(properties.minimap_width),
    syntaxHighlighter: properties.syntax_highlighter,
  };
}
