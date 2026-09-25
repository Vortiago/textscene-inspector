/**
 * The CodeHighlighter slice's decoded data (ADR-0031). `CodeHighlighter`
 * (`scene/resources/syntax_highlighter.cpp`) is Godot's one concrete
 * `SyntaxHighlighter`. Every field is an `ADD_PROPERTY` (`:604-611`).
 */

import type { Color } from '../../../utils/colorParser';

/**
 * One `color_regions` entry: a delimiter pair a region spans, across lines
 * unless `lineOnly`. `lineOnly` is `endKey === ''` (`CodeHighlighter::set_color_regions`,
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
   * longest `startKey` first, so `"""` is tried before `"`.
   */
  colorRegions: readonly CodeHighlighterColorRegion[];
  numberColor: Color;
  symbolColor: Color;
  functionColor: Color;
  memberVariableColor: Color;
}
