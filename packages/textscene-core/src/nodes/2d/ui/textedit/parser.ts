/**
 * TextEdit parser — Control base plus the subset of TextEdit's own 47
 * members a static preview draws. `linterParser.ts` format-checks every
 * member; this reads only the ones `nativeSolver.ts`/`Component.tsx` need.
 *
 * `scroll_horizontal`/`scroll_vertical` are deliberately NOT read here: both
 * are forced back to `(0, 0)` on the very first draw, because carets[0] sits
 * at (line 0, column 0) always (nothing in a `.tscn` can move it) and
 * `_notification(NOTIFICATION_DRAW)`'s `first_draw` branch calls
 * `adjust_viewport_to_caret()` (`text_edit.cpp:905-909`), which snaps the
 * viewport back to wherever caret 0 sits — see `nativeSolver.ts`'s own doc
 * for the full trace. A parsed-but-inert property would be dead code with no
 * test able to observe it.
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
    highlightCurrentLine: parseOptionalBool(properties.highlight_current_line),
    fitContentWidth: parseOptionalBool(properties.scroll_fit_content_width),
    fitContentHeight: parseOptionalBool(properties.scroll_fit_content_height),
    minimapDraw: parseOptionalBool(properties.minimap_draw),
    minimapWidth: parseOptionalInt(properties.minimap_width),
    syntaxHighlighter: properties.syntax_highlighter,
  };
}
