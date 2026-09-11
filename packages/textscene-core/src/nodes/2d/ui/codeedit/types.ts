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
  /**
   * Enables line folding. Godot default false. Parsed for completeness but
   * inert to what this slice draws: `can_fold_line` depends on this AND on
   * indentation/delimiter analysis this previewer does not perform (its own
   * gap is recorded in `comparison.md`), so the fold gutter's column is drawn
   * blank whether or not folding is enabled.
   */
  lineFolding?: boolean;
  /**
   * The tab stop width, in characters. Godot default 4. Parsed for
   * completeness but inert: `set_indent_size` forwards to `TextEdit::set_tab_size`,
   * which the shared text engine (`r3f/controls/native/text/textLayout.ts`,
   * off-limits to this packet) has no notion of — a tab always shapes at the
   * font's average-glyph-width fallback, whatever `indent_size` says.
   */
  indentSize?: number;
}
