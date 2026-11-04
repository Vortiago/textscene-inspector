/**
 * `TextParagraph::draw` shifts each line by its alignment (`text_paragraph.cpp:888-921`) and clips each line to `[clip_l, clip_l + width]` (`text_paragraph.cpp:925-930`):
 * `shaped_text_draw` skips a glyph that starts left of `clip_l` and stops at the first glyph whose
 * advance ends past `clip_r` (`text_server.cpp:1783-1808`).
 */
import { describe, expect, it } from 'vitest';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import { clipLineToDrawBox, textParagraphLineShiftPx } from './lineDrawClip';
import type { TextLineLayout } from './textLayout';

/** Ten glyphs `a`..`j`, each a 10 px advance at pen x 0, 10, 20, and so on. */
const LINE: TextLineLayout = {
  text: 'abcdefghij',
  widthPx: 100,
  glyphs: [...'abcdefghij'].map((char, index) => ({ char, x: index * 10, advance: 10, glyph: null })),
};

describe('clipLineToDrawBox', () => {
  it('stops at the first glyph whose advance ends past the box', () => {
    expect(clipLineToDrawBox(LINE, 35, 0).text).toBe('abc');
  });

  it('keeps a glyph whose advance ends exactly on the box edge', () => {
    expect(clipLineToDrawBox(LINE, 30, 0).text).toBe('abc');
  });

  it('skips the glyphs left of clip_l when a negative shift moves the line left', () => {
    // shift -25: ofs.x = -25, clip_l = 25, clip_r = 60. d starts at 30, g ends at 70 > 60.
    expect(clipLineToDrawBox(LINE, 35, -25).text).toBe('def');
  });

  it('keeps the pen extent, since alignment and sizing read it', () => {
    expect(clipLineToDrawBox(LINE, 35, 0).widthPx).toBe(100);
  });

  it('draws the whole line at zero or negative width, as `clip_r > 0` is false', () => {
    expect(clipLineToDrawBox(LINE, 0, 0)).toBe(LINE);
    expect(clipLineToDrawBox(LINE, -1, 0)).toBe(LINE);
  });

  it('returns the line itself when every glyph fits', () => {
    expect(clipLineToDrawBox(LINE, 100, 0)).toBe(LINE);
  });
});

describe('textParagraphLineShiftPx', () => {
  const { HORIZONTAL_ALIGNMENT_RIGHT, HORIZONTAL_ALIGNMENT_FILL } = HorizontalAlignment;

  it('moves a RIGHT line to the trailing edge under LTR', () => {
    expect(textParagraphLineShiftPx(30, 100, HORIZONTAL_ALIGNMENT_RIGHT, false)).toBe(70);
  });

  it('moves a FILL line to the trailing edge only under RTL', () => {
    expect(textParagraphLineShiftPx(30, 100, HORIZONTAL_ALIGNMENT_FILL, false)).toBe(0);
    expect(textParagraphLineShiftPx(30, 100, HORIZONTAL_ALIGNMENT_FILL, true)).toBe(70);
  });

  it('shifts nothing in a box with no width', () => {
    expect(textParagraphLineShiftPx(30, 0, HORIZONTAL_ALIGNMENT_RIGHT, false)).toBe(0);
  });
});
