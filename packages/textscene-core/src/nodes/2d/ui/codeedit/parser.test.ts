/** CodeEdit parser contract — TextEdit's own parse plus the gutter/indent members this slice draws. */
import { describe, it, expect } from 'vitest';
import { parseCodeEdit } from './parser';

const heading = { type: 'node', attributes: { type: 'CodeEdit', name: 'Editor' } };

describe('parseCodeEdit', () => {
  it('reads TextEdit base properties plus every gutter/indent property (happy path)', () => {
    const result = parseCodeEdit(heading, {
      text: '"func f():\n\tpass"',
      gutters_draw_line_numbers: 'true',
      gutters_zero_pad_line_numbers: 'true',
      gutters_line_numbers_min_digits: '2',
      gutters_draw_bookmarks: 'true',
      gutters_draw_breakpoints_gutter: 'true',
      gutters_draw_executing_lines: 'true',
      gutters_draw_fold_gutter: 'true',
      line_folding: 'true',
      indent_size: '2',
    });
    expect(result.name).toBe('Editor');
    expect(result.text).toBe('func f():\n\tpass');
    expect(result.gutterDrawLineNumbers).toBe(true);
    expect(result.gutterZeroPadLineNumbers).toBe(true);
    expect(result.gutterLineNumbersMinDigits).toBe(2);
    expect(result.gutterDrawBookmarks).toBe(true);
    expect(result.gutterDrawBreakpoints).toBe(true);
    expect(result.gutterDrawExecutingLines).toBe(true);
    expect(result.gutterDrawFoldGutter).toBe(true);
    expect(result.lineFolding).toBe(true);
    expect(result.indentSize).toBe(2);
  });

  it('leaves a malformed indent_size undefined rather than throwing (error path)', () => {
    expect(parseCodeEdit(heading, { indent_size: 'wide' }).indentSize).toBeUndefined();
  });

  it('handles a bare node with no properties at all (edge case)', () => {
    const result = parseCodeEdit({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.gutterDrawLineNumbers).toBeUndefined();
    expect(result.indentSize).toBeUndefined();
  });
});
