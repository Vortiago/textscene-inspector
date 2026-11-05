/**
 * CodeEdit's gutter geometry against `scene/gui/code_edit.cpp` (Godot 4.6.3). `get_minimum_size`
 * is TextEdit's, which `../textedit/nativeSolver.test.ts` covers.
 */
import { describe, expect, it } from 'vitest';
import {
  codeEditLineNumberText,
  codeEditLineNumberGutterXPx,
  codeEditLineNumberTextXPx,
  codeEditGutterCellTextTopPx,
  codeEditGutterBand,
  codeEditGuidelines,
} from './nativeSolver';
import type { CodeEditProperties } from './types';

describe('codeEditGutterBand line-number digits', () => {
  // code_edit.cpp:3875: MAX(line_numbers_min_digits, std::log10(lc) + 1), run by `text_set`.
  function digits(lineCount: number, gutterLineNumbersMinDigits?: number): number {
    const props = { text: '', gutterLineNumbersMinDigits } as CodeEditProperties;
    return codeEditGutterBand(props, 24, 8, lineCount).lineNumberDigits;
  }

  it('floors at the min-digits default for a small line count', () => {
    // code_edit.h:114 defaults line_numbers_min_digits to 3.
    expect(digits(1)).toBe(3);
  });
  it('grows past the default once the line count needs more digits', () => {
    expect(digits(10000)).toBe(5);
  });
  it('honours an explicit gutters_line_numbers_min_digits override', () => {
    expect(digits(1, 1)).toBe(1);
  });
});

describe('codeEditGutterBand line-number digits before any text change', () => {
  // `line_number_digits` starts at 1 (code_edit.h:113) and only `_text_changed` (code_edit.cpp:3875) or a
  // changed `line_numbers_min_digits` (:1536-1550) recomputes it, so a CodeEdit never given text keeps 1.
  function untouchedDigits(props: Partial<CodeEditProperties>): number {
    return codeEditGutterBand(props as CodeEditProperties, 24, 8, 1).lineNumberDigits;
  }

  it('keeps the constructor digit count for a CodeEdit with no text property', () => {
    expect(untouchedDigits({})).toBe(1);
  });
  it('recomputes once a text property, even an empty one, is assigned (text_edit.cpp:4006)', () => {
    expect(untouchedDigits({ text: '' })).toBe(3);
  });
  it('recomputes for a min-digits setter that changes the value', () => {
    expect(untouchedDigits({ gutterLineNumbersMinDigits: 5 })).toBe(5);
  });
  it('ignores a min-digits setter that repeats the default, which returns early', () => {
    expect(untouchedDigits({ gutterLineNumbersMinDigits: 3 })).toBe(1);
  });
});

const NO_LOCALE = { locale: '' };

describe('codeEditLineNumberText', () => {
  it('writes the digits of the locale, the padding first (`code_edit.cpp:1569-1572`)', () => {
    expect(codeEditLineNumberText(9, 3, true, { locale: 'ar' })).toBe('٠١٠');
    expect(codeEditLineNumberText(0, 3, false, { locale: 'fa' })).toBe('  ۱');
  });
  it('writes ASCII digits while localize_numeral_system is off', () => {
    expect(codeEditLineNumberText(0, 2, false, { locale: 'ar', localizeNumeralSystem: false })).toBe(' 1');
  });
  it('left-pads with a space by default', () => {
    expect(codeEditLineNumberText(0, 3, false, NO_LOCALE)).toBe('  1');
  });
  it('left-pads with a zero when gutters_zero_pad_line_numbers is set', () => {
    expect(codeEditLineNumberText(0, 3, true, NO_LOCALE)).toBe('001');
  });
  it('is 1-indexed: line index 0 reads as "1"', () => {
    expect(codeEditLineNumberText(9, 2, false, NO_LOCALE)).toBe('10');
  });
});

describe('codeEditLineNumberGutterXPx', () => {
  it('starts right after the style left margin when the main gutter is not drawn', () => {
    expect(codeEditLineNumberGutterXPx(4.2, 0)).toBe(5);
  });
  it('is pushed right by the main gutter width when it is drawn', () => {
    expect(codeEditLineNumberGutterXPx(4, 24)).toBe(28);
  });
});

describe('codeEditGutterCellTextTopPx', () => {
  it('centres the shaped text vertically within the row band', () => {
    expect(codeEditGutterCellTextTopPx(100, 20, 10)).toBe(105);
  });
});

describe('codeEditGutterBand', () => {
  const rowHeightPx = 24;
  const charWidth0Px = 8;

  it('draws no gutters, contributes zero width, when nothing is enabled', () => {
    const band = codeEditGutterBand({} as CodeEditProperties, rowHeightPx, charWidth0Px, 1);
    expect(band.mainDrawn).toBe(false);
    expect(band.lineNumbersDrawn).toBe(false);
    expect(band.foldDrawn).toBe(false);
    expect(band.totalWidthPx).toBe(2);
  });

  it('the main gutter draws (and costs one row height) if ANY of bookmarks/breakpoints/executing is set', () => {
    const band = codeEditGutterBand(
      { gutterDrawBreakpoints: true } as CodeEditProperties,
      rowHeightPx,
      charWidth0Px,
      1
    );
    expect(band.mainDrawn).toBe(true);
    expect(band.mainWidthPx).toBe(rowHeightPx);
  });

  it('the line-number gutter costs (digits+1) char-0 widths', () => {
    const band = codeEditGutterBand(
      { gutterDrawLineNumbers: true, text: '' } as CodeEditProperties,
      rowHeightPx,
      charWidth0Px,
      1
    );
    expect(band.lineNumberWidthPx).toBe((3 + 1) * charWidth0Px);
  });

  it('the fold gutter costs row height / 1.2', () => {
    const band = codeEditGutterBand(
      { gutterDrawFoldGutter: true } as CodeEditProperties,
      rowHeightPx,
      charWidth0Px,
      1
    );
    expect(band.foldWidthPx).toBe(20);
  });

  it('truncates each gutter width into the int set_gutter_width takes (text_edit.h:1120)', () => {
    const band = codeEditGutterBand(
      { text: '', gutterDrawLineNumbers: true, gutterDrawFoldGutter: true } as CodeEditProperties,
      25,
      9.1,
      1
    );
    expect(band.lineNumberWidthPx).toBe(36);
    expect(band.foldWidthPx).toBe(20);
  });

  it('carries gutter_padding even with every gutter off — the latch never opens (text_edit.cpp:8969-8971)', () => {
    // `_update_gutter_width` sets `gutter_padding = 2` and never clears it. `GutterInfo::draw`
    // defaults true (`text_edit.h:129`) and `add_gutter` updates at once (`:6709-6718`), so each
    // constructor gutter latches the padding before `set_gutter_draw(idx, false)` (`code_edit.cpp:3931-3953`).
    const withGutter = codeEditGutterBand(
      { gutterDrawLineNumbers: true } as CodeEditProperties,
      rowHeightPx,
      charWidth0Px,
      1
    );
    const without = codeEditGutterBand({} as CodeEditProperties, rowHeightPx, charWidth0Px, 1);
    expect(withGutter.totalWidthPx).toBe(withGutter.lineNumberWidthPx + 2);
    expect(without.totalWidthPx).toBe(2);
  });
});

describe('codeEditLineNumberTextXPx (text_edit.cpp:1471-1476, code_edit.cpp:1583-1587)', () => {
  it("sits at the gutter region's own left edge under LTR", () => {
    // `ofs.x = p_region.position.x` (:1586): the region starts at gutter_offset.
    expect(codeEditLineNumberTextXPx(26, 40, 300, 18, false)).toBe(26);
  });

  it('right-aligns inside a gutter region mirrored about the control under RTL', () => {
    // The region mirrors first (text_edit.cpp:1474): 300 - 26 - 40 = 234. The text then
    // right-aligns inside it (code_edit.cpp:1584): 234 + 40 - 18 = 256.
    expect(codeEditLineNumberTextXPx(26, 40, 300, 18, true)).toBe(256);
  });

  it('measures the number at its CEILED shaped size, as shaped_text_get_size does (edge case)', () => {
    expect(codeEditLineNumberTextXPx(26, 40, 300, 17.25, true)).toBe(256);
  });
});

/**
 * `CodeEdit::_draw_guidelines` (`code_edit.cpp:288-313`): a line down to `size.height` at
 * `xoffset = xmargin_beg + column_pos`, or `size.width - xoffset` under RTL, drawn only strictly
 * inside the margins, so neither column 0 nor a column past the text band draws. The first rule
 * takes the full colour and each later one half alpha. `get_h_scroll()` is 0.
 */
describe('codeEditGuidelines (code_edit.cpp:288-313)', () => {
  // A stubbed 8px-per-'0' measurement, so a font-metric change can never read
  // as a guideline-placement change.
  const width = (column: number) => column * 8;

  it('places each column at xmargin_beg plus its own measured width', () => {
    // `xoffset` is 26 + 32 and 26 + 80. The drawn column is one left of each
    // (the thin-line tie-break, this function's own doc).
    expect(codeEditGuidelines([4, 10], width, 26, 300, 320, false)).toEqual([
      { xPx: 57, dimmed: false },
      { xPx: 105, dimmed: true },
    ]);
  });

  it('dims every guideline after the first (code_edit.cpp:305)', () => {
    expect(codeEditGuidelines([2, 4, 6], width, 26, 300, 320, false).map((g) => g.dimmed)).toEqual([
      false,
      true,
      true,
    ]);
  });

  it('drops column 0, whose xoffset lands exactly on the strict lower bound', () => {
    expect(codeEditGuidelines([0], width, 26, 300, 320, false)).toEqual([]);
  });

  it('drops a column past the text band, strictly (code_edit.cpp:304)', () => {
    // xmargin_end is 300, so 8 * 34 + 26 = 298 draws and 8 * 35 + 26 = 306 does not.
    expect(codeEditGuidelines([34], width, 26, 300, 320, false)).toHaveLength(1);
    expect(codeEditGuidelines([35], width, 26, 300, 320, false)).toEqual([]);
  });

  it('keeps an out-of-band column from renumbering the ones that draw', () => {
    // The dim rule reads the authored index `i`, not the drawn one.
    expect(codeEditGuidelines([0, 4], width, 26, 300, 320, false)).toEqual([{ xPx: 57, dimmed: true }]);
  });

  it('mirrors each guideline about the control under RTL (code_edit.cpp:307)', () => {
    expect(codeEditGuidelines([4], width, 26, 300, 320, true)).toEqual([
      { xPx: 320 - 58 - 1, dimmed: false },
    ]);
  });

  it('draws nothing for an empty array (code_edit.cpp:289-291)', () => {
    expect(codeEditGuidelines([], width, 26, 300, 320, false)).toEqual([]);
  });
});
