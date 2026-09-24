/**
 * `CodeHighlighter::_get_line_syntax_highlighting_impl` (`syntax_highlighter.cpp:118-411`),
 * one branch per test. Every expected span is traced by hand against that function.
 */
import { describe, expect, it } from 'vitest';
import { resolveLineColors } from './highlight';
import type { CodeHighlighterData } from './types';
import type { Color } from '../../../utils/colorParser';

const FONT_COLOR: Color = { r: 0.875, g: 0.875, b: 0.875, a: 1 };
const KEYWORD_COLOR: Color = { r: 1, g: 0.2, b: 0.3, a: 1 };
const MEMBER_KEYWORD_COLOR: Color = { r: 0.2, g: 0.4, b: 1, a: 1 };
const STRING_COLOR: Color = { r: 0.9, g: 0.8, b: 0.3, a: 1 };
const COMMENT_COLOR: Color = { r: 0.5, g: 0.6, b: 0.5, a: 1 };
const NUMBER_COLOR: Color = { r: 0.6, g: 0.9, b: 0.9, a: 1 };
const SYMBOL_COLOR: Color = { r: 0.7, g: 0.7, b: 0.7, a: 1 };

const EMPTY: CodeHighlighterData = {
  keywordColors: new Map(),
  memberKeywordColors: new Map(),
  colorRegions: [],
  numberColor: NUMBER_COLOR,
  symbolColor: SYMBOL_COLOR,
  functionColor: { r: 0, g: 0, b: 0, a: 1 },
  memberVariableColor: { r: 0, g: 0, b: 0, a: 1 },
};

describe('resolveLineColors', () => {
  it('colours a keyword whole (in_keyword branch, syntax_highlighter.cpp:391-392)', () => {
    const highlighter: CodeHighlighterData = { ...EMPTY, keywordColors: new Map([['if', KEYWORD_COLOR]]) };
    const { spans, regionAtLineEnd } = resolveLineColors('if', highlighter, FONT_COLOR);
    expect(spans).toEqual([{ startIndex: 0, endIndex: 2, color: KEYWORD_COLOR }]);
    expect(regionAtLineEnd).toBe(-1);
  });

  it('colours a run of digits with number_color (is_number branch, :399-400)', () => {
    const { spans } = resolveLineColors('42', EMPTY, FONT_COLOR);
    expect(spans).toEqual([{ startIndex: 0, endIndex: 2, color: NUMBER_COLOR }]);
  });

  it('colours a whole "…" string region one colour, quotes included (:229-292)', () => {
    const highlighter: CodeHighlighterData = {
      ...EMPTY,
      colorRegions: [{ startKey: '"', endKey: '"', color: STRING_COLOR, lineOnly: false }],
    };
    const { spans, regionAtLineEnd } = resolveLineColors('"hi"', highlighter, FONT_COLOR);
    expect(spans).toEqual([{ startIndex: 0, endIndex: 4, color: STRING_COLOR }]);
    expect(regionAtLineEnd).toBe(-1); // closed on the same line.
  });

  it('colours a whole line-only "#" comment region, and never carries it over (:203-219)', () => {
    const highlighter: CodeHighlighterData = {
      ...EMPTY,
      colorRegions: [{ startKey: '#', endKey: '', color: COMMENT_COLOR, lineOnly: true }],
    };
    const { spans, regionAtLineEnd } = resolveLineColors('#hi', highlighter, FONT_COLOR);
    expect(spans).toEqual([{ startIndex: 0, endIndex: 3, color: COMMENT_COLOR }]);
    expect(regionAtLineEnd).toBe(-1);
  });

  it('colours a member keyword through the SAME in_keyword path as a plain keyword (:339-356)', () => {
    const highlighter: CodeHighlighterData = {
      ...EMPTY,
      memberKeywordColors: new Map([['position', MEMBER_KEYWORD_COLOR]]),
    };
    const { spans } = resolveLineColors('position', highlighter, FONT_COLOR);
    expect(spans).toEqual([{ startIndex: 0, endIndex: 8, color: MEMBER_KEYWORD_COLOR }]);
  });

  it('disqualifies a member keyword directly preceded by "." (:343-350), which falls through to the general member-variable path instead (:375-384)', () => {
    const MEMBER_VAR_COLOR: Color = { r: 0.9, g: 0.5, b: 0.2, a: 1 };
    const highlighter: CodeHighlighterData = {
      ...EMPTY,
      memberKeywordColors: new Map([['position', MEMBER_KEYWORD_COLOR]]),
      memberVariableColor: MEMBER_VAR_COLOR,
    };
    const { spans } = resolveLineColors('.position', highlighter, FONT_COLOR);
    // '.' is a symbol -> symbol_color; "position", preceded by a dot, is an
    // ordinary member access rather than the special member-keyword.
    expect(spans).toEqual([
      { startIndex: 0, endIndex: 1, color: SYMBOL_COLOR },
      { startIndex: 1, endIndex: 9, color: MEMBER_VAR_COLOR },
    ]);
  });

  it('carries an unterminated region across lines via color_region_cache (:141-152, :279-287)', () => {
    const highlighter: CodeHighlighterData = {
      ...EMPTY,
      colorRegions: [{ startKey: '"""', endKey: '"""', color: STRING_COLOR, lineOnly: false }],
    };
    const first = resolveLineColors('"""open', highlighter, FONT_COLOR, -1);
    expect(first.regionAtLineEnd).toBe(0); // region index 0, still open at EOL.
    const second = resolveLineColors('still open', highlighter, FONT_COLOR, first.regionAtLineEnd);
    expect(second.spans).toEqual([{ startIndex: 0, endIndex: 10, color: STRING_COLOR }]);
    expect(second.regionAtLineEnd).toBe(0); // still unterminated.
  });
});
