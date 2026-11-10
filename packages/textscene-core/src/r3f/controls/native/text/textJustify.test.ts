/**
 * `fitLineToWidth` ports `TextServer::shaped_text_fit_to_width`
 * (`modules/text_server_adv/text_server_adv.cpp:5531-5686`). Lines are hand-built, so each expected
 * value is one arithmetic step from the cited lines, apart from font-metric quantisation.
 */
import { describe, expect, it } from 'vitest';
import type { GlyphPlacement, TextLineLayout } from './textLayout';
import { justifyLinesToWidth, justifyParagraphs } from './textJustify';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { JustificationFlag } from '../../../../godot/text/textServerEnums';

const FONT_SIZE_PX = 16;

/** One line fitted alone: a single-line paragraph under flags with no skip bit. */
function fitLine(line: TextLineLayout, widthPx: number, flags: number): TextLineLayout {
  return justifyLinesToWidth([line], widthPx, flags)[0]!;
}

function mkLine(entries: Array<[char: string, advance: number]>): TextLineLayout {
  let x = 0;
  const glyphs: GlyphPlacement[] = entries.map(([char, advance]) => {
    const g = {
      char,
      x,
      advance,
      glyph: null,
      fontMetrics: OPEN_SANS_FONT_METRICS,
      fontSizePx: FONT_SIZE_PX,
    };
    x += advance;
    return g;
  });
  return { text: entries.map((e) => e[0]).join(''), glyphs, widthPx: x, paragraphIndex: 0 };
}

describe('fitLineToWidth', () => {
  it('WORD_BOUND grows every space glyph by an equal share of the slack (text_server_adv.cpp:5648-5675)', () => {
    const line = mkLine([
      ['A', 10.578125],
      [' ', 4.15625],
      ['A', 10.578125],
    ]);
    const fitted = fitLine(line, 35.3125, JustificationFlag.WORD_BOUND);
    expect(fitted.glyphs[1]!.advance).toBeCloseTo(14.15625, 10);
    expect(fitted.glyphs[2]!.x).toBeCloseTo(24.734375, 10);
    expect(fitted.widthPx).toBeCloseTo(35.3125, 10);
  });

  it('WORD_BOUND SHRINKS an overflowing line, floored at 0.1 * font_size per space (text_server_adv.cpp:5657-5661)', () => {
    const line = mkLine([
      ['A', 10.578125],
      [' ', 4.15625],
      ['A', 10.578125],
    ]);
    const fitted = fitLine(line, 20, JustificationFlag.WORD_BOUND);
    // delta = (20 - 25.3125) / 1 = -5.3125; 4.15625 - 5.3125 = -1.15625, floored to 0.1*16 = 1.6.
    expect(fitted.glyphs[1]!.advance).toBeCloseTo(1.6, 10);
    expect(fitted.widthPx).toBeCloseTo(22.75625, 10);
  });

  it('TRIM_EDGE_SPACES zeroes a leading and trailing space, excluding them from the space count (text_server_adv.cpp:5588-5599)', () => {
    const line = mkLine([
      [' ', 4.15625],
      ['A', 10.578125],
      [' ', 4.15625],
    ]);
    const fitted = fitLine(line, 30, JustificationFlag.WORD_BOUND | JustificationFlag.TRIM_EDGE_SPACES);
    expect(fitted.glyphs[0]!.advance).toBe(0);
    expect(fitted.glyphs[2]!.advance).toBe(0);
    // No interior space survives to stretch, so the line collapses to just 'A'.
    expect(fitted.widthPx).toBeCloseTo(10.578125, 10);
  });

  describe('without TRIM_EDGE_SPACES, a wrapped line keeps its edge spaces and skips the break spaces (text_server_adv.cpp:5600-5607)', () => {
    it('leaves a trailing break space out of the space count but keeps its width in the line', () => {
      const line = mkLine([
        ['A', 10],
        [' ', 4],
        ['B', 10],
        [' ', 4],
      ]);
      const fitted = fitLine(line, 40, JustificationFlag.WORD_BOUND);
      // The slack is 40 - 28, all for the one inner space: the trailing break space keeps its 4.
      expect(fitted.glyphs.map((glyph) => glyph.advance)).toEqual([10, 16, 10, 4]);
      expect(fitted.widthPx).toBe(40);
    });

    it('does not stretch a line whose only space is its break space', () => {
      const line = mkLine([
        ['A', 10],
        [' ', 4],
      ]);
      const fitted = fitLine(line, 40, JustificationFlag.WORD_BOUND);
      expect(fitted.glyphs.map((glyph) => glyph.advance)).toEqual([10, 4]);
    });

    it('leaves a leading break space out of the space count too', () => {
      const line = mkLine([
        [' ', 4],
        ['A', 10],
        [' ', 4],
        ['B', 10],
      ]);
      const fitted = fitLine(line, 40, JustificationFlag.WORD_BOUND);
      expect(fitted.glyphs.map((glyph) => glyph.advance)).toEqual([4, 10, 16, 10]);
    });

    it('counts a space that is not the last of its run, since a break follows only the last', () => {
      const line = mkLine([
        ['A', 10],
        [' ', 4],
        [' ', 4],
      ]);
      const fitted = fitLine(line, 40, JustificationFlag.WORD_BOUND);
      expect(fitted.glyphs.map((glyph) => glyph.advance)).toEqual([10, 26, 4]);
    });
  });

  it('AFTER_LAST_TAB only justifies the run past the LAST tab glyph (text_server_adv.cpp:5547-5570)', () => {
    const line = mkLine([
      [' ', 2],
      ['A', 5],
      ['\t', 3],
      ['B', 5],
      [' ', 2],
      ['C', 5],
    ]);
    const fitted = fitLine(line, 32, JustificationFlag.WORD_BOUND | JustificationFlag.AFTER_LAST_TAB);
    // The space BEFORE the tab (index 0) is untouched...
    expect(fitted.glyphs[0]!.advance).toBe(2);
    // ...only the one AFTER it (index 4) absorbs the whole 10px of slack.
    expect(fitted.glyphs[4]!.advance).toBe(12);
    expect(fitted.glyphs[5]!.x).toBe(27);
    expect(fitted.widthPx).toBe(32);
  });

  it('AFTER_LAST_TAB on a right-to-left line justifies only the run before the visually first tab', () => {
    // Visual order: the logically last tab is the leftmost glyph that is a tab.
    const line = {
      ...mkLine([
        ['C', 5],
        [' ', 2],
        ['B', 5],
        ['\t', 3],
        ['A', 5],
        [' ', 2],
      ]),
      isRtl: true,
    };
    const fitted = fitLine(line, 32, JustificationFlag.WORD_BOUND | JustificationFlag.AFTER_LAST_TAB);
    expect(fitted.glyphs[1]!.advance).toBe(12);
    expect(fitted.glyphs[5]!.advance).toBe(2);
  });

  it('a line with no glyphs is returned unchanged (edge)', () => {
    const line: TextLineLayout = { text: '', glyphs: [], widthPx: 0, paragraphIndex: 0 };
    const fitted = fitLine(line, 50, JustificationFlag.WORD_BOUND);
    expect(fitted).toBe(line);
  });
});

describe('fitLineToWidth space-shrink floor (text_server_adv.cpp:5659)', () => {
  // A 20px line that must fit 10px: the slack is -10 over one space, so the space would go below zero.
  const line = (): TextLineLayout =>
    mkLine([
      ['A', 10],
      [' ', 6],
      ['A', 10],
    ]);

  it('floors a space at a tenth of its own font size', () => {
    const base = line();
    const glyphs = base.glyphs.map((g) => (g.char === ' ' ? { ...g, fontSizePx: 40 } : g));
    const fitted = fitLine({ ...base, glyphs }, 10, JustificationFlag.WORD_BOUND);
    expect(fitted.glyphs[1]!.advance).toBe(4);
  });
});

describe('which lines of a paragraph the flags fit', () => {
  const FIT_WIDTH_PX = 100;
  const spaced = mkLine([
    ['A', 10],
    [' ', 4],
    ['A', 10],
  ]);
  const blank = mkLine([[' ', 4]]);
  const { SKIP_LAST_LINE, SKIP_LAST_LINE_WITH_VISIBLE_CHARS, DO_NOT_SKIP_SINGLE_LINE, WORD_BOUND } =
    JustificationFlag;

  /** Per line of one paragraph: whether it stretched to the fit width. */
  function fitted(lines: TextLineLayout[], flags: number): boolean[] {
    return justifyParagraphs(lines, { widthPx: FIT_WIDTH_PX, flags }).map(
      (line) => line.widthPx === FIT_WIDTH_PX
    );
  }

  it('fits every line when no skip flag is set', () => {
    expect(fitted([spaced, spaced, spaced], WORD_BOUND)).toEqual([true, true, true]);
  });

  it('leaves the last line alone under SKIP_LAST_LINE', () => {
    expect(fitted([spaced, spaced, spaced], WORD_BOUND | SKIP_LAST_LINE)).toEqual([true, true, false]);
  });

  it('fits a single line when DO_NOT_SKIP_SINGLE_LINE is set, whatever else is', () => {
    expect(fitted([spaced], WORD_BOUND | SKIP_LAST_LINE | DO_NOT_SKIP_SINGLE_LINE)).toEqual([true]);
  });

  it('skips a single line under SKIP_LAST_LINE without DO_NOT_SKIP_SINGLE_LINE', () => {
    expect(fitted([spaced], WORD_BOUND | SKIP_LAST_LINE)).toEqual([false]);
  });

  it('leaves the last line with visible characters and every line after it alone', () => {
    expect(fitted([spaced, spaced, blank], WORD_BOUND | SKIP_LAST_LINE_WITH_VISIBLE_CHARS)).toEqual([
      true,
      false,
      false,
    ]);
  });

  // The numeric masks of the issue: 163 is RichTextLabel's default (`rich_text_label.h:582`). WORD_BOUND is 2, KASHIDA 1.
  it.each([
    [163, [true, true, false]],
    [3, [true, true, true]],
  ])('mask %i fits the lines of a 3-line paragraph as %j', (flags, expected) => {
    expect(fitted([spaced, spaced, spaced], flags)).toEqual(expected);
  });

  it('mask 66 skips back to the last line with a non-space glyph', () => {
    expect(fitted([spaced, spaced, blank], 66)).toEqual([true, false, false]);
  });

  it('mask 34 skips a single line, and 162 with DO_NOT_SKIP_SINGLE_LINE fits one', () => {
    expect(fitted([spaced], 34)).toEqual([false]);
    expect(fitted([spaced], 162)).toEqual([true]);
  });

  it('mask 160 fits a single line but has no WORD_BOUND, so no space moves', () => {
    expect(fitted([spaced], 160)).toEqual([false]);
  });
});

describe('justifyParagraphs', () => {
  const FIT_WIDTH_PX = 100;
  const inParagraph = (paragraphIndex: number, ...entries: Array<[string, number]>): TextLineLayout => ({
    ...mkLine(entries),
    paragraphIndex,
  });
  const twoWords = (paragraphIndex: number): TextLineLayout =>
    inParagraph(paragraphIndex, ['A', 10], [' ', 4], ['A', 10]);
  const widthsOf = (lines: readonly TextLineLayout[]): number[] => lines.map((l) => l.widthPx);
  const options = { widthPx: FIT_WIDTH_PX, flags: 163 };

  it('fits the first line of each paragraph and skips the last line of each', () => {
    const lines = [twoWords(0), twoWords(0), twoWords(1), twoWords(1)];
    expect(widthsOf(justifyParagraphs(lines, options))).toEqual([100, 24, 100, 24]);
  });

  it('fits a single-line paragraph under DO_NOT_SKIP_SINGLE_LINE, the last paragraph too', () => {
    const lines = [twoWords(0), twoWords(1)];
    expect(widthsOf(justifyParagraphs(lines, options))).toEqual([100, 100]);
  });

  it('skips a paragraph the predicate refuses and fits the next', () => {
    const lines = [twoWords(0), twoWords(1)];
    const refuseFirst = { ...options, isFilled: (firstLineIndex: number) => firstLineIndex > 0 };
    expect(widthsOf(justifyParagraphs(lines, refuseFirst))).toEqual([24, 100]);
  });
});
