import { describe, expect, it } from 'vitest';
import { decodeCodeHighlighter } from './decode';

describe('decodeCodeHighlighter', () => {
  it('defaults every scalar Color to opaque black when absent', () => {
    // syntax_highlighter.h:89-93: Color members default-construct, and
    // Color() is (0,0,0,1) (core/math/color.h:251-252).
    const data = decodeCodeHighlighter({});
    expect(data.numberColor).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(data.symbolColor).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(data.functionColor).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(data.memberVariableColor).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(data.keywordColors.size).toBe(0);
    expect(data.memberKeywordColors.size).toBe(0);
    expect(data.colorRegions).toEqual([]);
  });

  it('reads the four scalar colours', () => {
    const data = decodeCodeHighlighter({
      number_color: 'Color(0.63, 0.86, 0.93, 1)',
      symbol_color: 'Color(0.78, 0.78, 0.78, 1)',
      function_color: 'Color(0.34, 0.7, 0.88, 1)',
      member_variable_color: 'Color(0.7, 0.9, 1, 1)',
    });
    expect(data.numberColor).toEqual({ r: 0.63, g: 0.86, b: 0.93, a: 1 });
    expect(data.symbolColor).toEqual({ r: 0.78, g: 0.78, b: 0.78, a: 1 });
    expect(data.functionColor).toEqual({ r: 0.34, g: 0.7, b: 0.88, a: 1 });
    expect(data.memberVariableColor).toEqual({ r: 0.7, g: 0.9, b: 1, a: 1 });
  });

  it('reads keyword_colors as a name -> Color map', () => {
    const data = decodeCodeHighlighter({
      keyword_colors: '{\n"if": Color(1, 0.44, 0.52, 1),\n"const": Color(0.34, 0.7, 0.88, 1)\n}',
    });
    expect(data.keywordColors.get('if')).toEqual({ r: 1, g: 0.44, b: 0.52, a: 1 });
    expect(data.keywordColors.get('const')).toEqual({ r: 0.34, g: 0.7, b: 0.88, a: 1 });
  });

  it('reads member_keyword_colors the same way', () => {
    const data = decodeCodeHighlighter({
      member_keyword_colors: '{\n"position": Color(0.7, 0.9, 1, 1)\n}',
    });
    expect(data.memberKeywordColors.get('position')).toEqual({ r: 0.7, g: 0.9, b: 1, a: 1 });
  });

  it('splits a color_regions key on its first space into start/end delimiters', () => {
    // syntax_highlighter.cpp:543-544: get_slicec(' ', 0) / (' ', 1).
    const data = decodeCodeHighlighter({
      color_regions: '{\n"\\" \\"": Color(0.9, 0.8, 0.6, 1),\n"#": Color(0.5, 0.5, 0.5, 1)\n}',
    });
    const byStart = new Map(data.colorRegions.map((r) => [r.startKey, r]));
    expect(byStart.get('"')).toMatchObject({ startKey: '"', endKey: '"', lineOnly: false });
    expect(byStart.get('#')).toMatchObject({ startKey: '#', endKey: '', lineOnly: true });
  });

  it('orders color_regions longest-startKey-first (add_color_region, syntax_highlighter.cpp:490-516)', () => {
    const data = decodeCodeHighlighter({
      color_regions:
        '{\n"\\" \\"": Color(1, 0, 0, 1),\n"\\"\\"\\" \\"\\"\\"": Color(0, 1, 0, 1)\n}',
    });
    expect(data.colorRegions.map((r) => r.startKey)).toEqual(['"""', '"']);
  });

  it('refuses a color region whose start key is not symbol-only', () => {
    // add_color_region's ERR_FAIL_COND_MSG (syntax_highlighter.cpp:492) drops
    // the whole entry.
    const data = decodeCodeHighlighter({
      color_regions: '{\n"a": Color(1, 0, 0, 1)\n}',
    });
    expect(data.colorRegions).toEqual([]);
  });
});
