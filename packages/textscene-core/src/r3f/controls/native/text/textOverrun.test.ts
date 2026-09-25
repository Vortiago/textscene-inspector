/**
 * `trimLineToWidth` ports `shaped_text_overrun_trim_to_width` (`modules/text_server_adv/text_server_adv.cpp:5935-6154`).
 * Advances at size 16 are even design units at 2048/em, so each lands on the continuous scale:
 * 'A' 1354 -> 10.578125, 'B' 1350 -> 10.546875, space 532 -> 4.15625, '…' 1672 -> 13.0625.
 */
import { describe, expect, it } from 'vitest';
import { AutowrapMode, shapeText } from './textLayout';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import {
  DEFAULT_ELLIPSIS_CHAR,
  OverrunBehavior,
  overrunFlagsForBehavior,
  trimLineToWidth,
  type OverrunTrimFlags,
} from './textOverrun';

const FONT_SIZE_PX = 16;

function line(text: string) {
  return shapeText(text, {
    fontSizePx: FONT_SIZE_PX,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.OFF,
    lineSpacingPx: 0,
  }).lines[0]!;
}

function trim(text: string, widthPx: number, flags: OverrunTrimFlags, ellipsisChar = DEFAULT_ELLIPSIS_CHAR) {
  return trimLineToWidth(line(text), widthPx, flags, { fontMetrics: OPEN_SANS_FONT_METRICS, fontSizePx: FONT_SIZE_PX, ellipsisChar });
}

describe('overrunFlagsForBehavior', () => {
  // text_server.cpp:2399-2432
  it('maps every OverrunBehavior to its own TextOverrunFlag set', () => {
    expect(overrunFlagsForBehavior(OverrunBehavior.NO_TRIMMING)).toEqual({
      trim: false, trimWordOnly: false, addEllipsis: false, enforceEllipsis: false, justificationAware: false,
    });
    expect(overrunFlagsForBehavior(OverrunBehavior.TRIM_CHAR)).toEqual({
      trim: true, trimWordOnly: false, addEllipsis: false, enforceEllipsis: false, justificationAware: false,
    });
    expect(overrunFlagsForBehavior(OverrunBehavior.TRIM_WORD_ELLIPSIS_FORCE)).toEqual({
      trim: true, trimWordOnly: true, addEllipsis: true, enforceEllipsis: true, justificationAware: false,
    });
  });
});

describe('trimLineToWidth', () => {
  it('NO_TRIMMING leaves the line untouched however narrow the box (text_server_adv.cpp:5958)', () => {
    const result = trim('AAAAAAAAAA', 10, overrunFlagsForBehavior(OverrunBehavior.NO_TRIMMING));
    expect(result.text).toBe('AAAAAAAAAA');
  });

  it('a line that already fits and is not enforced is untouched (text_server_adv.cpp:5958, `sd->width > p_width`)', () => {
    const result = trim('AAAA', 200, overrunFlagsForBehavior(OverrunBehavior.TRIM_ELLIPSIS));
    expect(result.text).toBe('AAAA');
    expect(result.widthPx).toBeCloseTo(4 * 10.578125, 10);
  });

  it('TRIM_CHAR cuts to the widest whole-glyph prefix, no ellipsis', () => {
    // 10 A's = 105.78125px; backward search finds i=4 the first index where
    // width-after-removal (42.3125) fits 50 (text_server_adv.cpp:6069-6108).
    const result = trim('AAAAAAAAAA', 50, overrunFlagsForBehavior(OverrunBehavior.TRIM_CHAR));
    expect(result.text).toBe('AAAA');
    expect(result.widthPx).toBeCloseTo(4 * 10.578125, 10);
  });

  it('TRIM_ELLIPSIS below ell_min_characters (6) falls back to a plain cut, no ellipsis (text_server_adv.cpp:6049,6074-6080)', () => {
    // Same cut as TRIM_CHAR above: the fitting prefix (4 chars) is below the
    // 6-character ellipsis threshold, so add_ellipsis never gets a chance.
    const result = trim('AAAAAAAAAA', 50, overrunFlagsForBehavior(OverrunBehavior.TRIM_ELLIPSIS));
    expect(result.text).toBe('AAAA');
    expect(result.widthPx).toBeCloseTo(4 * 10.578125, 10);
  });

  it('TRIM_ELLIPSIS at/above ell_min_characters appends the ellipsis glyph', () => {
    // 12 A's = 126.9375px; i=8 is the first index (>= 6) whose remaining
    // width (84.625) plus the ellipsis budget (13, truncated) fits 100.
    const result = trim('AAAAAAAAAAAA', 100, overrunFlagsForBehavior(OverrunBehavior.TRIM_ELLIPSIS));
    expect(result.text).toBe('AAAAAAAA…');
    expect(result.widthPx).toBeCloseTo(8 * 10.578125 + 13.0625, 10);
  });

  it('TRIM_WORD_ELLIPSIS only cuts at a space, inserting one before the ellipsis (text_server_adv.cpp:6081-6091,6124-6135)', () => {
    // "AAAAAA BBBBBB": every mid-word B index is skipped (not a soft break);
    // the space at index 6 is the first index >= 6 that both is a soft break
    // and whose width-after-removal (63.46875) plus the word-aware ellipsis
    // budget (17 = ellipsis 13.0625 + space 4.15625, truncated) fits 90.
    const result = trim('AAAAAA BBBBBB', 90, overrunFlagsForBehavior(OverrunBehavior.TRIM_WORD_ELLIPSIS));
    expect(result.text).toBe('AAAAAA …');
    expect(result.widthPx).toBeCloseTo(6 * 10.578125 + 4.15625 + 13.0625, 10);
  });

  it('ENFORCE_ELLIPSIS appends the ellipsis even when the line already fits, drawing every original glyph (text_server_adv.cpp:5958,6065-6067; text_server.cpp:1768-1777 trim_pos<0)', () => {
    const result = trim('AAAA', 200, overrunFlagsForBehavior(OverrunBehavior.TRIM_ELLIPSIS_FORCE));
    expect(result.text).toBe('AAAA…');
    expect(result.widthPx).toBeCloseTo(4 * 10.578125 + 13.0625, 10);
  });

  it('a custom ellipsis char outside the vendored charset falls back to three dots (text_server_adv.cpp:6007-6046 found_el_char)', () => {
    const result = trim('AAAAAAAAAAAA', 100, overrunFlagsForBehavior(OverrunBehavior.TRIM_ELLIPSIS), '●');
    expect(result.text).toBe('AAAAAAAA...');
  });

  it('OVERRUN_JUSTIFICATION_AWARE skips trimming until fit_width_minimum_reached is true (text_server_adv.cpp:5964-5966)', () => {
    const flags: OverrunTrimFlags = { trim: true, trimWordOnly: false, addEllipsis: true, enforceEllipsis: false, justificationAware: true };
    const untouched = trimLineToWidth(line('AAAAAAAAAA'), 50, flags, {
      fontMetrics: OPEN_SANS_FONT_METRICS, fontSizePx: FONT_SIZE_PX, fitWidthMinimumReached: false,
    });
    expect(untouched.text).toBe('AAAAAAAAAA');

    const trimmed = trimLineToWidth(line('AAAAAAAAAA'), 50, flags, {
      fontMetrics: OPEN_SANS_FONT_METRICS, fontSizePx: FONT_SIZE_PX, fitWidthMinimumReached: true,
    });
    expect(trimmed.text).toBe('AAAA');
  });
});
