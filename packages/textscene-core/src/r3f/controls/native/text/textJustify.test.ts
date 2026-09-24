/**
 * `fitLineToWidth` ports `TextServer::shaped_text_fit_to_width`
 * (`modules/text_server_adv/text_server_adv.cpp:5531-5686`). Lines are hand-built, so each expected
 * value is one arithmetic step from the cited lines, apart from font-metric quantisation.
 */
import { describe, expect, it } from 'vitest';
import type { GlyphPlacement, TextLineLayout } from './textLayout';
import { JustificationFlag, fitLineToWidth } from './textJustify';

const FONT_SIZE_PX = 16;

function mkLine(entries: Array<[char: string, advance: number]>): TextLineLayout {
  let x = 0;
  const glyphs: GlyphPlacement[] = entries.map(([char, advance]) => {
    const g = { char, x, advance, glyph: null };
    x += advance;
    return g;
  });
  return { text: entries.map((e) => e[0]).join(''), glyphs, widthPx: x };
}

describe('fitLineToWidth', () => {
  it('WORD_BOUND grows every space glyph by an equal share of the slack (text_server_adv.cpp:5648-5675)', () => {
    const line = mkLine([['A', 10.578125], [' ', 4.15625], ['A', 10.578125]]);
    const result = fitLineToWidth(line, 35.3125, JustificationFlag.WORD_BOUND, { fontSizePx: FONT_SIZE_PX });
    expect(result.line.glyphs[1]!.advance).toBeCloseTo(14.15625, 10);
    expect(result.line.glyphs[2]!.x).toBeCloseTo(24.734375, 10);
    expect(result.line.widthPx).toBeCloseTo(35.3125, 10);
    expect(result.fitWidthMinimumReached).toBe(false);
  });

  it('WORD_BOUND SHRINKS an overflowing line, floored at 0.1 * font_size per space (text_server_adv.cpp:5657-5661)', () => {
    const line = mkLine([['A', 10.578125], [' ', 4.15625], ['A', 10.578125]]);
    const result = fitLineToWidth(line, 20, JustificationFlag.WORD_BOUND, { fontSizePx: FONT_SIZE_PX });
    // delta = (20 - 25.3125) / 1 = -5.3125; 4.15625 - 5.3125 = -1.15625, floored to 0.1*16 = 1.6.
    expect(result.line.glyphs[1]!.advance).toBeCloseTo(1.6, 10);
    expect(result.line.widthPx).toBeCloseTo(22.75625, 10);
    // floor(20) < floor(22.75625): the floor stopped it from reaching widthPx.
    expect(result.fitWidthMinimumReached).toBe(true);
  });

  it('TRIM_EDGE_SPACES zeroes a leading and trailing space, excluding them from the space count (text_server_adv.cpp:5588-5599)', () => {
    const line = mkLine([[' ', 4.15625], ['A', 10.578125], [' ', 4.15625]]);
    const result = fitLineToWidth(
      line,
      30,
      JustificationFlag.WORD_BOUND | JustificationFlag.TRIM_EDGE_SPACES,
      { fontSizePx: FONT_SIZE_PX }
    );
    expect(result.line.glyphs[0]!.advance).toBe(0);
    expect(result.line.glyphs[2]!.advance).toBe(0);
    // No interior space survives to stretch, so the line collapses to just 'A'.
    expect(result.line.widthPx).toBeCloseTo(10.578125, 10);
  });

  it('AFTER_LAST_TAB only justifies the run past the LAST tab glyph (text_server_adv.cpp:5547-5570)', () => {
    const line = mkLine([[' ', 2], ['A', 5], ['\t', 3], ['B', 5], [' ', 2], ['C', 5]]);
    const result = fitLineToWidth(
      line,
      32,
      JustificationFlag.WORD_BOUND | JustificationFlag.AFTER_LAST_TAB,
      { fontSizePx: FONT_SIZE_PX }
    );
    // The space BEFORE the tab (index 0) is untouched...
    expect(result.line.glyphs[0]!.advance).toBe(2);
    // ...only the one AFTER it (index 4) absorbs the whole 10px of slack.
    expect(result.line.glyphs[4]!.advance).toBe(12);
    expect(result.line.glyphs[5]!.x).toBe(27);
    expect(result.line.widthPx).toBe(32);
  });

  it('a line with no glyphs is returned unchanged (edge)', () => {
    const line: TextLineLayout = { text: '', glyphs: [], widthPx: 0 };
    const result = fitLineToWidth(line, 50, JustificationFlag.WORD_BOUND, { fontSizePx: FONT_SIZE_PX });
    expect(result.line).toBe(line);
    expect(result.fitWidthMinimumReached).toBe(false);
  });
});
