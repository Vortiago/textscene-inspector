/**
 * CodeEdit's own gutter geometry vs `scene/gui/code_edit.cpp` (Godot 4.6.3).
 * `CodeEdit::get_minimum_size` itself is TextEdit's unchanged
 * (`../textedit/nativeSolver.test.ts` already covers that shared function).
 */
import { describe, expect, it } from 'vitest';
import {
  codeEditLineNumberDigits,
  codeEditLineNumberText,
  codeEditLineNumberGutterXPx,
  codeEditLineNumberTextXPx,
  codeEditGutterCellTextTopPx,
  codeEditGutterBand,
  CODE_EDIT_LINE_NUMBERS_MIN_DIGITS_DEFAULT,
} from './nativeSolver';
import type { CodeEditProperties } from './types';

describe('codeEditLineNumberDigits', () => {
  // code_edit.cpp:3875: MAX(line_numbers_min_digits, std::log10(lc) + 1).
  it('floors at the min-digits default (3) for a small line count', () => {
    expect(codeEditLineNumberDigits(1, undefined)).toBe(CODE_EDIT_LINE_NUMBERS_MIN_DIGITS_DEFAULT);
  });
  it('grows past the default once the line count needs more digits', () => {
    expect(codeEditLineNumberDigits(10000, undefined)).toBe(5);
  });
  it('honours an explicit gutters_line_numbers_min_digits override', () => {
    expect(codeEditLineNumberDigits(1, 1)).toBe(1);
  });
});

describe('codeEditLineNumberText', () => {
  it('left-pads with a space by default', () => {
    expect(codeEditLineNumberText(0, 3, false)).toBe('  1');
  });
  it('left-pads with a zero when gutters_zero_pad_line_numbers is set', () => {
    expect(codeEditLineNumberText(0, 3, true)).toBe('001');
  });
  it('is 1-indexed: line index 0 reads as "1"', () => {
    expect(codeEditLineNumberText(9, 2, false)).toBe('10');
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
    expect(band.totalWidthPx).toBe(0);
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
      { gutterDrawLineNumbers: true } as CodeEditProperties,
      rowHeightPx,
      charWidth0Px,
      1
    );
    expect(band.lineNumberWidthPx).toBe((CODE_EDIT_LINE_NUMBERS_MIN_DIGITS_DEFAULT + 1) * charWidth0Px);
  });

  it('the fold gutter costs row height / 1.2', () => {
    const band = codeEditGutterBand({ gutterDrawFoldGutter: true } as CodeEditProperties, rowHeightPx, charWidth0Px, 1);
    expect(band.foldWidthPx).toBeCloseTo(rowHeightPx / 1.2, 6);
  });

  it('adds a 2px gutter_padding once ANY gutter is drawn, and none when all are off', () => {
    const withGutter = codeEditGutterBand(
      { gutterDrawLineNumbers: true } as CodeEditProperties,
      rowHeightPx,
      charWidth0Px,
      1
    );
    const without = codeEditGutterBand({} as CodeEditProperties, rowHeightPx, charWidth0Px, 1);
    expect(withGutter.totalWidthPx).toBe(withGutter.lineNumberWidthPx + 2);
    expect(without.totalWidthPx).toBe(0);
  });
});

describe('codeEditLineNumberTextXPx (text_edit.cpp:1471-1476, code_edit.cpp:1583-1587)', () => {
  it('sits at the gutter region\'s own left edge under LTR', () => {
    // `ofs.x = p_region.position.x` (:1586) — the region starts at gutter_offset.
    expect(codeEditLineNumberTextXPx(26, 40, 300, 18, false)).toBe(26);
  });

  it('right-aligns inside a gutter region mirrored about the control under RTL', () => {
    // The CUSTOM gutter's own region mirrors first — `gutter_rect.position.x =
    // size.width - gutter_rect.position.x - gutter_rect.size.x` (text_edit.cpp:1474)
    // -> 300 - 26 - 40 = 234 — then the text right-aligns inside it,
    // `ofs.x = p_region.get_end().x - text_size.width` (code_edit.cpp:1584) ->
    // 234 + 40 - 18 = 256.
    expect(codeEditLineNumberTextXPx(26, 40, 300, 18, true)).toBe(256);
  });

  it('measures the number at its CEILED shaped size, as shaped_text_get_size does (edge case)', () => {
    expect(codeEditLineNumberTextXPx(26, 40, 300, 17.25, true)).toBe(256);
  });
});
