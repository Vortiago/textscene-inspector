/**
 * `TextParagraph::draw` shifts each line by its alignment (`text_paragraph.cpp:888-921`) and clips each line to `[clip_l, clip_l + width]` (`text_paragraph.cpp:925-930`):
 * `shaped_text_draw` skips a glyph that starts left of `clip_l` and stops at the first glyph whose
 * advance ends past `clip_r` (`text_server.cpp:1783-1808`).
 */
import { describe, expect, it } from 'vitest';
import { HorizontalAlignment } from '../../../../godot/math/alignment';
import { drawnLinesInBox, textParagraphLineShiftPx } from './lineDrawClip';
import type { TextLineLayout } from './textLayout';

/** Ten glyphs `a`..`j`, each a 10 px advance at pen x 0, 10, 20, and so on. */
const LINE: TextLineLayout = {
  text: 'abcdefghij',
  widthPx: 100,
  glyphs: [...'abcdefghij'].map((char, index) => ({ char, x: index * 10, advance: 10, glyph: null })),
};

describe('drawnLinesInBox cuts each line to the box', () => {
  const { HORIZONTAL_ALIGNMENT_LEFT, HORIZONTAL_ALIGNMENT_RIGHT } = HorizontalAlignment;
  const cut = (boxWidthPx: number, alignment: number) =>
    drawnLinesInBox([LINE], boxWidthPx, alignment, false)[0]!.line;

  it('stops at the first glyph whose advance ends past the box', () => {
    expect(cut(35, HORIZONTAL_ALIGNMENT_LEFT).text).toBe('abc');
  });

  it('keeps a glyph whose advance ends exactly on the box edge', () => {
    expect(cut(30, HORIZONTAL_ALIGNMENT_LEFT).text).toBe('abc');
  });

  it('skips the glyphs left of clip_l when a negative shift moves the line left', () => {
    // RIGHT in a 75 box: shift -25, so clip_l = 25 and clip_r = 100. c starts at 20, d at 30.
    expect(cut(75, HORIZONTAL_ALIGNMENT_RIGHT).text).toBe('defghij');
  });

  it('keeps the trailing glyphs of a RIGHT line in a narrow box', () => {
    expect(cut(35, HORIZONTAL_ALIGNMENT_RIGHT).text).toBe('hij');
  });

  it('keeps the pen extent, since alignment and sizing read it', () => {
    expect(cut(35, HORIZONTAL_ALIGNMENT_LEFT).widthPx).toBe(100);
  });

  it('draws the whole line at zero or negative width, as `clip_r > 0` is false', () => {
    expect(cut(0, HORIZONTAL_ALIGNMENT_LEFT)).toBe(LINE);
    expect(cut(-1, HORIZONTAL_ALIGNMENT_LEFT)).toBe(LINE);
  });

  it('returns the line itself when every glyph fits', () => {
    expect(cut(100, HORIZONTAL_ALIGNMENT_LEFT)).toBe(LINE);
  });

  it('reports the shift each line was given', () => {
    expect(drawnLinesInBox([LINE], 35, HORIZONTAL_ALIGNMENT_RIGHT, false)[0]!.shiftPx).toBe(-65);
  });
});

describe('drawnLinesInBox leaves a trim ellipsis uncut (text_server.cpp:1811-1822)', () => {
  const ellipsis = { char: '…', x: 20, advance: 13, glyph: null, isEllipsis: true };
  const trimmed: TextLineLayout = {
    text: 'ab…',
    widthPx: 33,
    glyphs: [...LINE.glyphs.slice(0, 2), ellipsis],
  };

  it('draws the ellipsis past a box narrower than it', () => {
    const [drawn] = drawnLinesInBox([trimmed], 25, HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT, false);
    expect(drawn!.line.text).toBe('ab…');
  });

  it('draws the ellipsis of a line that kept no glyph', () => {
    const lone: TextLineLayout = { text: '…', widthPx: 13, glyphs: [ellipsis] };
    const [drawn] = drawnLinesInBox([lone], 2, HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT, false);
    expect(drawn!.line.text).toBe('…');
  });

  it('drops the ellipsis with the glyphs after the first one that overflows the box', () => {
    const [drawn] = drawnLinesInBox([trimmed], 15, HorizontalAlignment.HORIZONTAL_ALIGNMENT_LEFT, false);
    expect(drawn!.line.text).toBe('a');
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
