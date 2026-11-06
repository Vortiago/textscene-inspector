/**
 * Tests which glyphs and characters a RichTextLabel shows under `visible_characters`, against
 * `scene/gui/rich_text_label.cpp:943-947,1466` (the draw-time skip) and `:668-671` (the
 * Before Shaping cut). The expected strings are measured through `pnpm ref:godot` on
 * `unit-rich-text-label-visible-characters.tscn`.
 */
import { describe, expect, it } from 'vitest';
import { shapeText } from '../../../../r3f/controls/native/text/textLayout';
import { visualChars } from '../../../../r3f/controls/native/text/textLayout.testkit';
import { AutowrapMode, VisibleCharactersBehavior } from '../../../../godot/text/textServerEnums';
import type { StyledTextRun } from './nativeSolver';
import { IMAGE_OBJECT_CHAR } from './bbcode';
import {
  countedCharacters,
  countedLayoutForReveal,
  revealedGlyphs,
  richTextReveal,
  truncateRunsToCharacters,
} from './visibleCharacters';

const { VC_CHARS_BEFORE_SHAPING, VC_CHARS_AFTER_SHAPING, VC_GLYPHS_AUTO, VC_GLYPHS_LTR, VC_GLYPHS_RTL } =
  VisibleCharactersBehavior;

/** The zero-width glyph that ends each paragraph but the last. */
const PARAGRAPH_TERMINATOR = '\u200b';

/** The text shaped as RichTextLabel does: `\n` ends a paragraph with no terminator after the last. */
function shape(text: string, boxWidthPx = 0) {
  return shapeText(text, {
    fontSizePx: 16,
    boxWidthPx,
    autowrapMode: boxWidthPx > 0 ? AutowrapMode.AUTOWRAP_WORD_SMART : AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 0,
    paragraphSeparator: '\n',
    terminateLastParagraph: false,
  });
}

/** The characters drawn, one string per line, after the reveal hides glyphs. */
function shown(
  text: string,
  reveal: Parameters<typeof revealedGlyphs>[2],
  boxWidthPx = 0,
  implicitBreaks?: number[]
): string[] {
  const layout = shape(text, boxWidthPx);
  const kept = revealedGlyphs(countedLayoutForReveal(layout, [{ text, implicitBreaks }], reveal)!, reveal);
  return layout.lines.map((line) =>
    visualChars({ ...line, glyphs: line.glyphs.filter((g) => kept!.has(g)) }).replaceAll(
      PARAGRAPH_TERMINATOR,
      ''
    )
  );
}

describe('revealedGlyphs', () => {
  // Measured with `pnpm ref:godot` on "abcdefgh" plus a ligature at visible_ratio 0.99: the default font
  // draws `fi` as one glyph, so nine glyphs make a limit of eight and the ligature stays hidden.
  it('counts the default font ligature fi as one glyph under GLYPHS_LTR (:8017-8033)', () => {
    expect(shown('abcdefghfi', { behavior: VC_GLYPHS_LTR, characters: 9, ratio: 0.99, rtl: false })).toEqual([
      'abcdefgh',
    ]);
    expect(shown('abcdefghft', { behavior: VC_GLYPHS_LTR, characters: 9, ratio: 0.99, rtl: false })).toEqual([
      'abcdefghf',
    ]);
  });

  it('shows no glyph at or past the character budget under CHARS_AFTER_SHAPING (:1466)', () => {
    expect(
      shown('Hello world', { behavior: VC_CHARS_AFTER_SHAPING, characters: 5, ratio: 5 / 11, rtl: false })
    ).toEqual(['Hello']);
  });

  // Measured with a `TextParagraph` on the default font: `add_string("f")` then `add_string("i")` is two
  // glyphs where `add_string("fi")` is one, so a ligature never joins glyphs of two runs.
  it('counts f and i of two runs as two glyphs', () => {
    const layout = shape('abcdefghfi');
    const reveal = { behavior: VC_GLYPHS_LTR, characters: 9, ratio: 0.99, rtl: false };
    const runs = [{ text: 'abcdefghf' }, { text: 'i' }];
    const kept = revealedGlyphs(countedLayoutForReveal(layout, runs, reveal)!, reveal);
    expect(
      layout.lines.map((line) => visualChars({ ...line, glyphs: line.glyphs.filter((g) => kept!.has(g)) }))
    ).toEqual(['abcdefghf']);
  });

  // A Godot `String` holds code points, so `😀` is one character where the JS string holds two units.
  it('counts an astral character as one under CHARS_AFTER_SHAPING', () => {
    expect(
      shown('😀ab', { behavior: VC_CHARS_AFTER_SHAPING, characters: 2, ratio: 2 / 3, rtl: false })
    ).toEqual(['😀a']);
  });

  it('counts an astral character as one glyph under GLYPHS_LTR', () => {
    expect(shown('😀ab', { behavior: VC_GLYPHS_LTR, characters: 2, ratio: 0.7, rtl: false })).toEqual([
      '😀a',
    ]);
  });

  it('counts an astral character and an implicit break together', () => {
    expect(
      shown('😀\nab', { behavior: VC_CHARS_AFTER_SHAPING, characters: 2, ratio: 0.5, rtl: false }, 0, [2])
    ).toEqual(['😀', 'a']);
  });

  it('counts the newline as one character (:645)', () => {
    expect(
      shown('ab\ncd', { behavior: VC_CHARS_AFTER_SHAPING, characters: 4, ratio: 0.8, rtl: false })
    ).toEqual(['ab', 'c']);
  });

  // Measured through `pnpm ref:godot`: visible_ratio 0.55 over two ten-character paragraphs draws the
  // first only. Its terminator is the eleventh glyph, and 21 glyphs at 0.55 allow 11.
  it('counts the paragraph terminator as a glyph under GLYPHS_LTR', () => {
    const reveal = { behavior: VC_GLYPHS_LTR, characters: 11, ratio: 0.55, rtl: false };
    expect(shown('abcdefghij\nklmnopqrst', reveal)).toEqual(['abcdefghij', '']);
  });

  it('carries the count across three paragraphs', () => {
    // 32 glyphs at 0.8 allow 25: two paragraphs and their terminators take 22, leaving "uvw".
    const reveal = { behavior: VC_GLYPHS_LTR, characters: 25, ratio: 0.8, rtl: false };
    expect(shown('abcdefghij\nklmnopqrst\nuvwxyzabcd', reveal)).toEqual(['abcdefghij', 'klmnopqrst', 'uvw']);
  });

  it('counts an edge space the wrap trims in the total but not in the lines', () => {
    // 44 glyphs at 0.8 allow 35. The first line draws 22, its trailing space drawing nothing, so the second shows 13.
    const reveal = { behavior: VC_GLYPHS_LTR, characters: 35, ratio: 0.8, rtl: false };
    expect(shown('Hello world, this is a long line that wraps.', reveal, 170)).toEqual([
      'Hello world, this is a',
      'long line tha',
    ]);
  });

  // Measured through `pnpm ref:godot` on "under line and [right]right para[/right]\nsecond para here",
  // at visible_characters 30 under CHARS_AFTER_SHAPING: Godot draws "seco". The newline that
  // `[right]` adds after "and " is no character there, so "s" is character 26, not 27.
  it('counts no character for an implicit break', () => {
    const reveal = { behavior: VC_CHARS_AFTER_SHAPING, characters: 30, ratio: 0.7, rtl: false };
    const text = 'under line and \nright para\nsecond para here';
    expect(shown(text, reveal, 0, [15])).toEqual(['under line and ', 'right para', 'seco']);
  });

  it('has no terminator glyph for an implicit break to count (Godot has none)', () => {
    // 4 glyphs at 0.75 allow 3: "ab" and "c". A terminator counted as a glyph would make 5, and allow 3 of them: "ab" alone.
    const reveal = { behavior: VC_GLYPHS_LTR, characters: 3, ratio: 0.75, rtl: false };
    expect(shown('ab\ncd', reveal, 0, [2])).toEqual(['ab', 'c']);
  });

  it('counts glyphs from the back under GLYPHS_RTL (:945)', () => {
    expect(shown('abcd\nefgh', { behavior: VC_GLYPHS_RTL, characters: 5, ratio: 0.5, rtl: false })).toEqual([
      '',
      'efgh',
    ]);
  });

  it('picks the end by the layout direction under GLYPHS_AUTO (:944-945)', () => {
    const reveal = { behavior: VC_GLYPHS_AUTO, characters: 5, ratio: 0.5 };
    expect(shown('abcd\nefgh', { ...reveal, rtl: false })).toEqual(['abcd', '']);
    expect(shown('abcd\nefgh', { ...reveal, rtl: true })).toEqual(['', 'efgh']);
  });

  it('skips no glyph before shaping, which cuts the text instead', () => {
    const reveal = { behavior: VC_CHARS_BEFORE_SHAPING, characters: 2, ratio: 0.4, rtl: false };
    expect(countedLayoutForReveal(shape('Hello'), [{ text: 'Hello' }], reveal)).toBeUndefined();
  });
});

describe('countedCharacters', () => {
  it('counts an astral character as one, and no character for an implicit break', () => {
    expect(countedCharacters([{ text: '😀a' }, { text: '\nb', implicitBreaks: [0] }])).toBe(3);
  });
});

describe('richTextReveal', () => {
  it('is undefined while visible_characters is unset or -1', () => {
    expect(richTextReveal({ visibleCharacters: undefined }, false, 0)).toBeUndefined();
    expect(richTextReveal({ visibleCharacters: -1, visibleRatio: 1 }, false, 0)).toBeUndefined();
  });

  it('defaults the behaviour to CHARS_BEFORE_SHAPING', () => {
    expect(richTextReveal({ visibleCharacters: 3, visibleRatio: 0.5 }, true, 6)).toEqual({
      behavior: VC_CHARS_BEFORE_SHAPING,
      characters: 3,
      ratio: 0.5,
      rtl: true,
    });
  });

  // `get_total_character_count` counts an `[img]` only once Godot loaded its texture (:4210, :5992-6040),
  // so a ratio re-derives its characters from the total of the runs that are drawn.
  it('re-derives the characters of a ratio from the total it is given', () => {
    const props = { visibleCharacters: 3, visibleRatio: 0.5, visibleRatioDrives: true as const };
    expect(richTextReveal(props, false, 6)?.characters).toBe(3);
    expect(richTextReveal(props, false, 5)?.characters).toBe(2);
  });

  it('re-derives the ratio of characters from the total it is given', () => {
    const props = { visibleCharacters: 3, visibleRatio: 0.5 };
    expect(richTextReveal(props, false, 5)?.ratio).toBeCloseTo(0.6);
    expect(richTextReveal(props, false, 0)?.ratio).toBe(0.5);
  });
});

describe('truncateRunsToCharacters (:668-671)', () => {
  const run = (text: string, implicitBreaks?: number[]): StyledTextRun =>
    ({ text, implicitBreaks }) as StyledTextRun;

  it('cuts the run the budget ends in and drops the runs after it', () => {
    expect(truncateRunsToCharacters([run('ab'), run('cd'), run('ef')], 3).map((r) => r.text)).toEqual([
      'ab',
      'c',
    ]);
  });

  it('cuts after an astral character, which counts one', () => {
    expect(truncateRunsToCharacters([run('😀ab')], 2).map((r) => r.text)).toEqual(['😀a']);
  });

  it('drops every run at zero', () => {
    expect(truncateRunsToCharacters([run('ab')], 0)).toEqual([]);
  });

  it('keeps an image placeholder, which is one character', () => {
    expect(
      truncateRunsToCharacters([run('a'), run(IMAGE_OBJECT_CHAR), run('b')], 2).map((r) => r.text)
    ).toEqual(['a', IMAGE_OBJECT_CHAR]);
  });

  it('counts no character for an implicit break, and leaves one after the budget out', () => {
    const text = 'abc\nde';
    expect(truncateRunsToCharacters([run(text, [3])], 3).map((r) => r.text)).toEqual(['abc']);
    expect(truncateRunsToCharacters([run(text, [3])], 4).map((r) => r.text)).toEqual(['abc\nd']);
  });
});
