import { describe, expect, it } from 'vitest';
import { caretDrawWidthPx } from './caretWidth';

describe('caretDrawWidthPx (line_edit.cpp:1550, text_edit.cpp:1766)', () => {
  it('scales caret_width by the theme base scale', () => {
    expect(caretDrawWidthPx({ caret_width: 4 }, 1.5)).toBe(6);
    expect(caretDrawWidthPx({ caret_width: 1 }, 2)).toBe(2);
  });

  it('truncates a fractional width as the int cast does', () => {
    expect(caretDrawWidthPx({ caret_width: 1 }, 1.5)).toBe(1);
  });

  it('keeps the authored width below scale 1', () => {
    expect(caretDrawWidthPx({ caret_width: 3 }, 0.5)).toBe(3);
  });
});
