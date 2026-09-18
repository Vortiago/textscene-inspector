/** CodeEdit property definitions — TextEdit plus the gutters this slice draws. */

import type { TextEditProperties } from '../textedit/types';

export interface CodeEditProperties extends TextEditProperties {
  /** Draws the line-numbers gutter. Godot default false. */
  gutterDrawLineNumbers?: boolean;
  /** Left-pads a line number with `0` instead of a space. Godot default false. */
  gutterZeroPadLineNumbers?: boolean;
  /** The line-number gutter's own minimum digit count. Godot default 3. */
  gutterLineNumbersMinDigits?: number;
  /** Reserves the main gutter's column for bookmark icons. Godot default false. */
  gutterDrawBookmarks?: boolean;
  /** Reserves the main gutter's column for breakpoint icons. Godot default false. */
  gutterDrawBreakpoints?: boolean;
  /** Reserves the main gutter's column for the executing-line icon. Godot default false. */
  gutterDrawExecutingLines?: boolean;
  /** Reserves the fold gutter's own column. Godot default false. */
  gutterDrawFoldGutter?: boolean;
  /** Enables line folding, which is what lets the fold gutter draw an arrow at all (`can_fold_line`, `code_edit.cpp:1664`). Godot default false. */
  lineFolding?: boolean;
  /**
   * The tab stop width, in characters. Godot default 4.
   * `set_indent_size` forwards to `TextEdit::set_tab_size`
   * (`code_edit.cpp:908-920`), which re-aligns every tab glyph to a
   * `indent_size`-wide repeating stop (`textedit/nativeSolver.ts`'s
   * `textEditTabStopsPx`) — a real rendered-width effect.
   */
  indentSize?: number;
  /** The columns `_draw_guidelines` rules the whole control at (`code_edit.cpp:288-313`). Godot default empty. */
  lineLengthGuidelines?: number[];
  /** `"<start>[ <end>]"` per entry (`code_edit.cpp:3490-3508`) — the comment regions `can_fold_line` reads. Godot default empty. */
  delimiterComments?: string[];
  /** The string regions, same spelling. `undefined` keeps the constructor's own `"` and `'` (`code_edit.cpp:3920-3922`). */
  delimiterStrings?: string[];
}
