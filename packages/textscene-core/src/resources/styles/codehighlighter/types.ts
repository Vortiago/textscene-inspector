/**
 * The CodeHighlighter slice's decoded data (ADR-0031).
 *
 * `CodeHighlighter` (`scene/resources/syntax_highlighter.cpp`) is the one
 * concrete `SyntaxHighlighter` Godot ships; the base class adds no property of
 * its own. Every field here is a real `ADD_PROPERTY` (`:604-611`) — `font_color`
 * and `uint_suffix_enabled`, both plain class members with NO `ADD_PROPERTY`,
 * are deliberately absent (`decode.ts`'s own doc has why).
 */

import type { Color } from '../../../utils/colorParser';

/**
 * One `color_regions` entry — a start/end delimiter pair a line can enter and
 * (unless `lineOnly`) stay inside across lines. `lineOnly` is never authored
 * directly: it is `endKey === ''` (`CodeHighlighter::set_color_regions`,
 * `syntax_highlighter.cpp:537-549`), a comment-style region with no closer.
 */
export interface CodeHighlighterColorRegion {
  startKey: string;
  endKey: string;
  color: Color;
  lineOnly: boolean;
}

export interface CodeHighlighterData {
  keywordColors: ReadonlyMap<string, Color>;
  memberKeywordColors: ReadonlyMap<string, Color>;
  /**
   * Sorted by `add_color_region`'s own insertion rule (`syntax_highlighter.cpp:490-516`):
   * longest `startKey` first, so a longer delimiter (`"""`) is tried before a
   * shorter one (`"`) that would otherwise match its opening character first.
   */
  colorRegions: readonly CodeHighlighterColorRegion[];
  numberColor: Color;
  symbolColor: Color;
  functionColor: Color;
  memberVariableColor: Color;
}
