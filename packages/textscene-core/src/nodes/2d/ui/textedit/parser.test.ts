/** TextEdit parser contract: the Control base plus the subset a static preview draws. */
import { describe, it, expect } from 'vitest';
import { parseTextEdit } from './parser';

const heading = { type: 'node', attributes: { type: 'TextEdit', name: 'Editor' } };

describe('parseTextEdit', () => {
  it('reads text, newlines and all, plus every other drawn property (happy path)', () => {
    const result = parseTextEdit(heading, {
      text: '"line one\nline two"',
      placeholder_text: '"type here"',
      editable: 'false',
      wrap_mode: '1',
      autowrap_mode: '2',
      draw_tabs: 'true',
      draw_spaces: 'true',
      highlight_current_line: 'true',
      scroll_fit_content_width: 'true',
      scroll_fit_content_height: 'true',
      minimap_draw: 'true',
      minimap_width: '120',
      draw_control_chars: 'true',
    });
    expect(result.name).toBe('Editor');
    expect(result.text).toBe('line one\nline two');
    expect(result.placeholderText).toBe('type here');
    expect(result.editable).toBe(false);
    expect(result.wrapMode).toBe(1);
    expect(result.autowrapMode).toBe(2);
    expect(result.drawTabs).toBe(true);
    expect(result.drawSpaces).toBe(true);
    expect(result.highlightCurrentLine).toBe(true);
    expect(result.fitContentWidth).toBe(true);
    expect(result.fitContentHeight).toBe(true);
    expect(result.minimapDraw).toBe(true);
    expect(result.minimapWidth).toBe(120);
    expect(result.drawControlChars).toBe(true);
  });

  it('leaves a malformed boolean as false rather than throwing (error path)', () => {
    expect(parseTextEdit(heading, { draw_tabs: 'not-a-bool' }).drawTabs).toBe(false);
  });

  it('handles a bare node with no properties at all (edge case)', () => {
    const result = parseTextEdit({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.text).toBeUndefined();
    expect(result.editable).toBeUndefined();
    expect(result.wrapMode).toBeUndefined();
  });
});
