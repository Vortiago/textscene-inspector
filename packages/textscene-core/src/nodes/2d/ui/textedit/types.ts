/** TextEdit properties: the subset a static preview draws. */

import type { ControlProperties } from '../control/types';

export interface TextEditProperties extends ControlProperties {
  /** The buffer, real newlines and all. Godot default "". */
  text?: string;
  /** Shown, dimmed, whenever `text` is empty. Godot default "". */
  placeholderText?: string;
  /** Godot default true. A read-only TextEdit wears the `read_only` stylebox and `font_readonly_color`. */
  editable?: boolean;
  /** `LineWrappingMode`: 0=NONE, 1=BOUNDARY. Godot default 0 (`text_edit.h:526`). */
  wrapMode?: number;
  /** `TextServer::AutowrapMode`: 1=ARBITRARY, 2=WORD, 3=WORD_SMART, the break rule `wrapMode` BOUNDARY uses. Godot default 3 (`text_edit.h:527`). */
  autowrapMode?: number;
  /** Draws the `tab` theme icon over each tab grapheme. Godot default false. */
  drawTabs?: boolean;
  /** Draws the `space` theme icon over each space grapheme. Godot default false. */
  drawSpaces?: boolean;
  /** Draws an unshapeable control character as a hex-code box instead of dropping it (`Text::set_draw_control_chars`). Godot default false. */
  drawControlChars?: boolean;
  /** Paints the caret's own line in `current_line_color`. Godot default false. */
  highlightCurrentLine?: boolean;
  /** Draws the caret even unfocused, while `editable` is false (`text_edit.cpp:945-947`). Godot default false. */
  caretDrawWhenEditableDisabled?: boolean;
  /** Steps every wrapped row in by the line's own leading indent, and breaks it at the narrowed width (`text_edit.cpp:285-287,1488-1494`). Godot default false. */
  indentWrappedLines?: boolean;
  /** Grows this Control's minimum width to fit its widest (wrapped) row. Godot default false. */
  fitContentWidth?: boolean;
  /** Grows this Control's minimum height to fit every (wrapped) row. Godot default false. */
  fitContentHeight?: boolean;
  /** Reserves horizontal space for the (unrendered) minimap. Godot default false. */
  minimapDraw?: boolean;
  /** The reserved minimap width, Godot px. Godot default 80. */
  minimapWidth?: number;
  /**
   * `syntax_highlighter = ExtResource(...)` / `SubResource(...)`, raw. `Component.tsx`
   * resolves it against this node's `solveNode.resources`, as with `theme`.
   */
  syntaxHighlighter?: string;
}
