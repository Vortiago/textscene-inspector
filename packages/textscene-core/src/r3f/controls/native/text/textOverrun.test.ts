/**
 * `trimLineToWidth` ports `shaped_text_overrun_trim_to_width` (`modules/text_server_adv/text_server_adv.cpp:5935-6154`).
 * Advances at size 16 are even design units at 2048/em, so each lands on the continuous scale:
 * 'A' 1354 -> 10.578125, 'B' 1350 -> 10.546875, space 532 -> 4.15625, '…' 1672 -> 13.0625.
 */
import { describe, expect, it } from 'vitest';
import { shapeText, type TextLineLayout } from './textLayout';
import { getFontEmboldenedAdvancePx, withVariation } from './fontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { createOpenSansCanvasFontMetrics } from './openSansCanvasFontMetrics';
import { overrunFlagsForBehavior, trimLineToWidth, type OverrunTrimFlags } from './textOverrun';
import { AutowrapMode, OverrunBehavior, TextDirection } from '../../../../godot/text/textServerEnums';

const FONT_SIZE_PX = 16;

function line(text: string) {
  return shapeText(text, {
    fontSizePx: FONT_SIZE_PX,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 0,
  }).lines[0]!;
}

/** Trims with Godot's default ellipsis unless `ellipsisChar` names another. */
function trim(text: string, widthPx: number, flags: OverrunTrimFlags, ellipsisChar?: string) {
  return trimLineToWidth(line(text), widthPx, flags, {
    fontMetrics: OPEN_SANS_FONT_METRICS,
    fontSizePx: FONT_SIZE_PX,
    ellipsisChar,
  });
}

/** The characters a trimmed line draws, left to right. */
function drawnText(trimmed: TextLineLayout): string {
  return trimmed.glyphs.map((glyph) => glyph.char).join('');
}

describe('overrunFlagsForBehavior', () => {
  // text_server.cpp:2399-2432
  it('maps every OverrunBehavior to its own TextOverrunFlag set', () => {
    expect(overrunFlagsForBehavior(OverrunBehavior.OVERRUN_NO_TRIMMING)).toEqual({
      trim: false,
      trimWordOnly: false,
      addEllipsis: false,
      enforceEllipsis: false,
    });
    expect(overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_CHAR)).toEqual({
      trim: true,
      trimWordOnly: false,
      addEllipsis: false,
      enforceEllipsis: false,
    });
    expect(overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_WORD_ELLIPSIS_FORCE)).toEqual({
      trim: true,
      trimWordOnly: true,
      addEllipsis: true,
      enforceEllipsis: true,
    });
  });
});

describe('trimLineToWidth', () => {
  it('NO_TRIMMING leaves the line untouched however narrow the box (text_server_adv.cpp:5958)', () => {
    const result = trim('AAAAAAAAAA', 10, overrunFlagsForBehavior(OverrunBehavior.OVERRUN_NO_TRIMMING));
    expect(drawnText(result)).toBe('AAAAAAAAAA');
  });

  it('a line that already fits and is not enforced is untouched (text_server_adv.cpp:5958, `sd->width > p_width`)', () => {
    const result = trim('AAAA', 200, overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS));
    expect(drawnText(result)).toBe('AAAA');
    expect(result.widthPx).toBeCloseTo(4 * 10.578125, 10);
  });

  it('TRIM_CHAR cuts to the widest whole-glyph prefix, no ellipsis', () => {
    // 10 A's = 105.78125px; backward search finds i=4 the first index where
    // width-after-removal (42.3125) fits 50 (text_server_adv.cpp:6069-6108).
    const result = trim('AAAAAAAAAA', 50, overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_CHAR));
    expect(drawnText(result)).toBe('AAAA');
    expect(result.widthPx).toBeCloseTo(4 * 10.578125, 10);
  });

  it('TRIM_ELLIPSIS below ell_min_characters (6) falls back to a plain cut, no ellipsis (text_server_adv.cpp:6049,6074-6080)', () => {
    // Same cut as TRIM_CHAR above: the fitting prefix (4 chars) is below the
    // 6-character ellipsis threshold, so add_ellipsis never gets a chance.
    const result = trim('AAAAAAAAAA', 50, overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS));
    expect(drawnText(result)).toBe('AAAA');
    expect(result.widthPx).toBeCloseTo(4 * 10.578125, 10);
  });

  it('TRIM_ELLIPSIS at/above ell_min_characters appends the ellipsis glyph', () => {
    // 12 A's = 126.9375px; i=8 is the first index (>= 6) whose remaining
    // width (84.625) plus the ellipsis budget (13, truncated) fits 100.
    const result = trim('AAAAAAAAAAAA', 100, overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS));
    expect(drawnText(result)).toBe('AAAAAAAA…');
    // `width_trimmed` adds the truncated `int ellipsis_width` (`text_server_adv.cpp:6044,6152`).
    expect(result.widthPx).toBeCloseTo(8 * 10.578125 + 13, 10);
  });

  it('draws the ellipsis of an emboldened face with the widened advance and the outline growth', () => {
    const fontMetrics = withVariation(OPEN_SANS_FONT_METRICS, { embolden: 1.2 });
    const shaped = shapeText('AAAAAAAAAAAA', {
      fontSizePx: FONT_SIZE_PX,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      lineSpacingPx: 0,
      fontMetrics,
    }).lines[0]!;
    const flags = overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS);
    const ellipsis = trimLineToWidth(shaped, 100, flags, { fontMetrics, fontSizePx: FONT_SIZE_PX }).glyphs.at(
      -1
    )!;
    expect(ellipsis.char).toBe('…');
    expect(ellipsis.advance).toBeCloseTo(getFontEmboldenedAdvancePx(fontMetrics, '…', FONT_SIZE_PX), 10);
    expect(ellipsis.emboldenGrowthPx).toBeCloseTo(1.2, 10);
  });

  it('TRIM_WORD_ELLIPSIS only cuts at a space, inserting one before the ellipsis (text_server_adv.cpp:6081-6091,6124-6135)', () => {
    // "AAAAAA BBBBBB": every mid-word B index is skipped (not a soft break);
    // the space at index 6 is the first index >= 6 that both is a soft break
    // and whose width-after-removal (63.46875) plus the word-aware ellipsis
    // budget (17 = ellipsis 13.0625 + space 4.15625, truncated) fits 90.
    const result = trim(
      'AAAAAA BBBBBB',
      90,
      overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_WORD_ELLIPSIS)
    );
    expect(drawnText(result)).toBe('AAAAAA …');
    expect(result.widthPx).toBeCloseTo(6 * 10.578125 + 17, 10);
  });

  it('ENFORCE_ELLIPSIS appends the ellipsis even when the line already fits, drawing every original glyph (text_server_adv.cpp:5958,6065-6067; text_server.cpp:1768-1777 trim_pos<0)', () => {
    const result = trim('AAAA', 200, overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS_FORCE));
    expect(drawnText(result)).toBe('AAAA…');
    expect(result.widthPx).toBeCloseTo(4 * 10.578125 + 13, 10);
  });

  it('a custom ellipsis char outside the vendored charset falls back to three dots (text_server_adv.cpp:6007-6046 found_el_char)', () => {
    const result = trim(
      'AAAAAAAAAAAA',
      100,
      overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS),
      '●'
    );
    expect(drawnText(result)).toBe('AAAAAAAA...');
  });

  it('the bundled canvas metrics keep that fallback: a custom ellipsis char Open Sans lacks gives three dots (text_server_adv.cpp:5985 _font_has_char)', () => {
    const result = trimLineToWidth(
      line('AAAAAAAAAAAA'),
      100,
      overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS),
      {
        fontMetrics: createOpenSansCanvasFontMetrics('sans-serif'),
        fontSizePx: FONT_SIZE_PX,
        ellipsisChar: '→',
      }
    );
    expect(drawnText(result)).toBe('AAAAAAAA...');
  });
});

describe('trimLineToWidth — a right-to-left line (text_server_adv.cpp:6053-6114, label.h:198-241)', () => {
  const HEBREW = 'אבגדהוזחטיכל';

  function trimRtl(widthPx: number, behavior: number) {
    return trimLineToWidth(line(HEBREW), widthPx, overrunFlagsForBehavior(behavior), {
      fontMetrics: OPEN_SANS_FONT_METRICS,
      fontSizePx: FONT_SIZE_PX,
    });
  }

  it('cuts at the visual left and keeps the logical start', () => {
    const full = line(HEBREW);
    const result = trimRtl(full.widthPx / 2, OverrunBehavior.OVERRUN_TRIM_CHAR);
    const sources = result.glyphs.map((glyph) => glyph.sourceIndex);
    expect(sources.at(-1)).toBe(0);
    expect(sources[0]).toBeLessThan(HEBREW.length - 1);
    expect(result.widthPx).toBeLessThanOrEqual(full.widthPx / 2);
  });

  it('draws the ellipsis at the visual left of the kept glyphs', () => {
    const full = line(HEBREW);
    const result = trimRtl(full.widthPx * 0.75, OverrunBehavior.OVERRUN_TRIM_ELLIPSIS);
    expect(result.glyphs[0]!.char).toBe('…');
    expect(result.glyphs[0]!.x).toBe(0);
    expect(result.glyphs.at(-1)!.sourceIndex).toBe(0);
    let penX = 0;
    for (const glyph of result.glyphs) {
      expect(glyph.x).toBeCloseTo(penX, 9);
      penX += glyph.advance;
    }
    const dots = result.glyphs[0]!.advance;
    expect(result.widthPx).toBeCloseTo(penX - dots + Math.trunc(dots), 9);
    expect(result.widthPx).toBeLessThanOrEqual(full.widthPx * 0.75);
  });

  it('puts the ellipsis first when it is enforced on a line that fits', () => {
    const full = line(HEBREW);
    const result = trimRtl(full.widthPx + 100, OverrunBehavior.OVERRUN_TRIM_ELLIPSIS_FORCE);
    expect(result.glyphs[0]!.char).toBe('…');
    expect(result.glyphs.length).toBe(full.glyphs.length + 1);
  });

  it('keeps no glyph when only the logically first one fits, as the cut loop stops before it', () => {
    const full = line(HEBREW);
    const firstGlyph = full.glyphs.at(-1)!;
    const result = trimRtl(firstGlyph.advance + 0.5, OverrunBehavior.OVERRUN_TRIM_CHAR);
    expect(result.glyphs).toEqual([]);
  });

  it('draws the glyphs the cut removed when an AUTO line infers RTL (`text_server.cpp` shaped_text_draw)', () => {
    const full = line(HEBREW);
    const flags = overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS);
    const options = { fontMetrics: OPEN_SANS_FONT_METRICS, fontSizePx: FONT_SIZE_PX };
    const rtl = trimLineToWidth(full, full.widthPx * 0.75, flags, options);
    const auto = trimLineToWidth(full, full.widthPx * 0.75, flags, { ...options, isDrawnRtl: false });
    const keptCount = rtl.glyphs.length - 1;
    const removedCount = full.glyphs.length - keptCount;
    expect(auto.glyphs.map((glyph) => glyph.sourceIndex)).toEqual([
      ...full.glyphs.slice(0, removedCount).map((glyph) => glyph.sourceIndex),
      undefined,
    ]);
    expect(auto.glyphs.at(-1)!.char).toBe('…');
    expect(auto.widthPx).toBeCloseTo(rtl.widthPx, 9);
  });

  // `width_trimmed = width + (ellipsis_pos != -1 ? ellipsis_width : 0)` (`text_server_adv.cpp:6152`).
  it('gives a trimmed line the width Godot aligns by: the kept advance plus the truncated ellipsis', () => {
    const full = line(HEBREW);
    const result = trimRtl(full.widthPx * 0.75, OverrunBehavior.OVERRUN_TRIM_ELLIPSIS);
    const [dots, ...kept] = result.glyphs;
    const keptPx = kept.reduce((sum, glyph) => sum + glyph.advance, 0);
    expect(result.widthPx).toBeCloseTo(keptPx + Math.trunc(dots!.advance), 9);
  });

  it('keeps the last glyph in the width when an RTL cut finds no place, as the loop stops before it', () => {
    const full = line(HEBREW);
    const result = trimRtl(1, OverrunBehavior.OVERRUN_TRIM_CHAR);
    expect(result.widthPx).toBeCloseTo(full.glyphs.at(-1)!.advance, 9);
  });

  it('cuts a Hebrew line set LTR from the visual right, as its paragraph direction is LTR', () => {
    const full = shapeText(HEBREW, {
      fontSizePx: FONT_SIZE_PX,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      lineSpacingPx: 0,
      direction: TextDirection.TEXT_DIRECTION_LTR,
    }).lines[0]!;
    const result = trimLineToWidth(
      full,
      full.widthPx * 0.75,
      overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS),
      { fontMetrics: OPEN_SANS_FONT_METRICS, fontSizePx: FONT_SIZE_PX }
    );
    expect(result.glyphs.at(-1)!.char).toBe('…');
    expect(result.glyphs[0]!.sourceIndex).toBe(HEBREW.length - 1);
  });
});
