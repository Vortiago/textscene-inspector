/**
 * `trimLine` ports `shaped_text_overrun_trim_to_width` (`modules/text_server_adv/text_server_adv.cpp:5935-6154`).
 * Advances at size 16 are even design units at 2048/em, so each lands on the continuous scale:
 * 'A' 1354 -> 10.578125, 'B' 1350 -> 10.546875, space 532 -> 4.15625, '…' 1672 -> 13.0625.
 */
import { describe, expect, it } from 'vitest';
import { shapeText, type TextLineLayout } from './textLayout';
import { getFontEmboldenedAdvancePx, withVariation } from './fontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import { OPEN_SANS_CANVAS_FONT_METRICS } from './openSansCanvasFontMetrics';
import {
  isTextWidthClipped,
  overrunFlagsForBehavior,
  trimSoloLine,
  trimLayoutToWidth,
  trimLine,
  inferredPlacement,
  filledPlacement,
  textBufferPlacement,
  type OverrunTrimFlags,
} from './textOverrun';
import {
  AutowrapMode,
  JustificationFlag,
  OverrunBehavior,
  TextDirection,
} from '../../../../godot/text/textServerEnums';

const FONT_SIZE_PX = 16;
/** Twelve Hebrew letters: an AUTO paragraph that resolves right-to-left. */
const HEBREW = 'אבגדהוזחטיכל';

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
  return trimLine(
    line(text),
    widthPx,
    flags,
    {
      fontMetrics: OPEN_SANS_FONT_METRICS,
      fontSizePx: FONT_SIZE_PX,
      ellipsisChar,
    },
    inferredPlacement
  );
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
      shortStringEllipsis: false,
    });
    expect(overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_CHAR)).toEqual({
      trim: true,
      trimWordOnly: false,
      addEllipsis: false,
      enforceEllipsis: false,
      shortStringEllipsis: false,
    });
    expect(overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_WORD_ELLIPSIS_FORCE)).toEqual({
      trim: true,
      trimWordOnly: true,
      addEllipsis: true,
      enforceEllipsis: false,
      shortStringEllipsis: true,
    });
  });
});

describe('trimLine', () => {
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

  it('marks only the appended ellipsis glyphs, which the draw clip leaves uncut', () => {
    const result = trim('AAAAAAAAAAAA', 100, overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS));
    expect(result.glyphs.map((glyph) => glyph.isEllipsis === true)).toEqual([
      ...Array<boolean>(8).fill(false),
      true,
    ]);
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
    const ellipsis = trimLine(
      shaped,
      100,
      flags,
      { fontMetrics, fontSizePx: FONT_SIZE_PX },
      inferredPlacement
    ).glyphs.at(-1)!;
    expect(ellipsis.char).toBe('…');
    expect(ellipsis.advance).toBeCloseTo(getFontEmboldenedAdvancePx(fontMetrics, '…', FONT_SIZE_PX), 10);
    expect(ellipsis.emboldenGrowthPx).toBeCloseTo(1.2, 10);
  });

  // A canvas raster scales the measured ink of a glyph by its own size (`canvasTextPainter.ts`).
  it('sizes the space and the ellipsis it appends at the trim size', () => {
    const result = trim(
      'AAAAAA BBBBBB',
      90,
      overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_WORD_ELLIPSIS)
    );
    expect(result.glyphs.slice(-2).map(({ char, fontSizePx }) => [char, fontSizePx])).toEqual([
      [' ', FONT_SIZE_PX],
      ['…', FONT_SIZE_PX],
    ]);
  });

  it('TRIM_WORD_ELLIPSIS only cuts at a space, inserting one before the ellipsis (text_server_adv.cpp:6081-6091,6124-6135)', () => {
    // "AAAAAA BBBBBB": every mid-word B index is skipped (not a soft break);
    // the space at index 6 is the first index >= 6 that both is a soft break
    // and whose width-after-removal (63.46875) plus the word-aware ellipsis
    // budget (17 = ellipsis 13.0625 + space 4.15625, truncated) fits 90, and the width counts all 17 (`:6152`).
    const result = trim(
      'AAAAAA BBBBBB',
      90,
      overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_WORD_ELLIPSIS)
    );
    expect(drawnText(result)).toBe('AAAAAA …');
    expect(result.widthPx).toBeCloseTo(6 * 10.578125 + 17, 10);
  });

  it('ENFORCE_ELLIPSIS appends the ellipsis even when the line already fits, drawing every original glyph (text_server_adv.cpp:5958,6065-6067; text_server.cpp:1768-1777 trim_pos<0)', () => {
    const flags = {
      ...overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS),
      enforceEllipsis: true,
    };
    const result = trim('AAAA', 200, flags);
    expect(drawnText(result)).toBe('AAAA…');
    expect(result.widthPx).toBeCloseTo(4 * 10.578125 + 13, 10);
  });

  it('a FORCE behaviour leaves a line that fits untouched, as only ENFORCE_ELLIPSIS passes the fit test (text_server_adv.cpp:5958; text_server.cpp:2407-2425)', () => {
    const result = trim('AAAA', 200, overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS_FORCE));
    expect(drawnText(result)).toBe('AAAA');
  });

  it('a FORCE behaviour ends an overflowing short string in an ellipsis, where the plain behaviour keeps its 6 character floor', () => {
    const ellipsis = trim('AAAAA', 40, overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS));
    const forced = trim('AAAAA', 40, overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS_FORCE));
    expect(drawnText(ellipsis).endsWith('…')).toBe(false);
    expect(drawnText(forced).endsWith('…')).toBe(true);
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
    const result = trimLine(
      line('AAAAAAAAAAAA'),
      100,
      overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS),
      {
        fontMetrics: OPEN_SANS_CANVAS_FONT_METRICS,
        fontSizePx: FONT_SIZE_PX,
        ellipsisChar: '→',
      },
      inferredPlacement
    );
    expect(drawnText(result)).toBe('AAAAAAAA...');
  });
});

describe('trimLine — a right-to-left line (text_server_adv.cpp:6053-6114, label.h:198-241)', () => {
  function trimRtl(widthPx: number, behavior: number) {
    return trimLine(
      line(HEBREW),
      widthPx,
      overrunFlagsForBehavior(behavior),
      {
        fontMetrics: OPEN_SANS_FONT_METRICS,
        fontSizePx: FONT_SIZE_PX,
      },
      inferredPlacement
    );
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
    const enforced = {
      ...overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS),
      enforceEllipsis: true,
    };
    const result = trimLine(
      full,
      full.widthPx + 100,
      enforced,
      {
        fontMetrics: OPEN_SANS_FONT_METRICS,
        fontSizePx: FONT_SIZE_PX,
      },
      inferredPlacement
    );
    expect(result.glyphs[0]!.char).toBe('…');
    expect(result.glyphs.length).toBe(full.glyphs.length + 1);
  });

  it('keeps no glyph when only the logically first one fits, as the cut loop stops before it', () => {
    const full = line(HEBREW);
    const firstGlyph = full.glyphs.at(-1)!;
    const result = trimRtl(firstGlyph.advance + 0.5, OverrunBehavior.OVERRUN_TRIM_CHAR);
    expect(result.glyphs).toEqual([]);
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
    const result = trimLine(
      full,
      full.widthPx * 0.75,
      overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS),
      { fontMetrics: OPEN_SANS_FONT_METRICS, fontSizePx: FONT_SIZE_PX },
      inferredPlacement
    );
    expect(result.glyphs.at(-1)!.char).toBe('…');
    expect(result.glyphs[0]!.sourceIndex).toBe(HEBREW.length - 1);
  });
});

describe('textBufferPlacement — an AUTO line whose paragraph resolved right-to-left (text_server.cpp:1740-1935)', () => {
  const ELLIPSIS = overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS);
  const OPTIONS = { fontMetrics: OPEN_SANS_FONT_METRICS, fontSizePx: FONT_SIZE_PX };

  function trimBuffer(widthPx: number) {
    return trimLine(line(HEBREW), widthPx, ELLIPSIS, OPTIONS, textBufferPlacement(false));
  }

  it('draws the outline as the right-to-left trim keeps it, the ellipsis first', () => {
    const full = line(HEBREW);
    const result = trimBuffer(full.widthPx * 0.75);
    const outline = result.outlineGlyphs!;
    expect(outline[0]!.char).toBe('…');
    expect(outline.at(-1)!.sourceIndex).toBe(0);
  });

  it('draws the fill from the glyphs the right-to-left cut drops, then the ellipsis', () => {
    const full = line(HEBREW);
    const result = trimBuffer(full.widthPx * 0.75);
    const keptCount = result.outlineGlyphs!.length - 1;
    expect(result.glyphs[0]!.sourceIndex).toBe(HEBREW.length - 1);
    expect(result.glyphs.at(-1)!.char).toBe('…');
    expect(result.glyphs).toHaveLength(HEBREW.length - keptCount + 1);
  });

  it('stops the fill at the width, without the ellipsis, when the dropped glyphs overflow it', () => {
    const full = line(HEBREW);
    const widthPx = full.widthPx * 0.3;
    const result = trimBuffer(widthPx);
    const last = result.glyphs.at(-1)!;
    expect(result.glyphs.some((glyph) => glyph.char === '…')).toBe(false);
    expect(last.x + last.advance).toBeLessThanOrEqual(widthPx);
    expect(result.glyphs[0]!.sourceIndex).toBe(HEBREW.length - 1);
  });

  it('reports the width of the right-to-left trim, which both draws place by', () => {
    const full = line(HEBREW);
    const inferred = trimLine(full, full.widthPx * 0.75, ELLIPSIS, OPTIONS, inferredPlacement);
    expect(trimBuffer(full.widthPx * 0.75).widthPx).toBe(inferred.widthPx);
  });

  // A set RTL direction is the paragraph direction too, so the fill draws as the outline does.
  it('draws one glyph set for a line set RTL', () => {
    const full = line(HEBREW);
    const result = trimLine(full, full.widthPx * 0.75, ELLIPSIS, OPTIONS, textBufferPlacement(true));
    expect(result.outlineGlyphs).toBeUndefined();
    expect(result.glyphs[0]!.char).toBe('…');
    expect(result).toEqual(trimLine(full, full.widthPx * 0.75, ELLIPSIS, OPTIONS, inferredPlacement));
  });

  it('draws one glyph set for a left-to-right line', () => {
    const result = trimLine(line('AAAAAAAAAAAA'), 100, ELLIPSIS, OPTIONS, textBufferPlacement(false));
    expect(result.outlineGlyphs).toBeUndefined();
    expect(drawnText(result)).toBe('AAAAAAAA…');
  });

  it('keeps the paragraph indent of the line it trims', () => {
    const indented = { ...line('AAAAAAAAAAAA'), indentPx: 12 };
    expect(trimLine(indented, 100, ELLIPSIS, OPTIONS, textBufferPlacement(false)).indentPx).toBe(12);
  });

  it('leaves a line that fits unchanged', () => {
    const full = line(HEBREW);
    expect(trimLine(full, full.widthPx + 1, ELLIPSIS, OPTIONS, textBufferPlacement(false))).toBe(full);
  });
});

describe('filledPlacement — the fit after the trim, JUSTIFICATION_CONSTRAIN_ELLIPSIS (label.cpp:325, text_server_adv.cpp:5573-5583)', () => {
  // The ellipsis advances 13.0625 and `ellipsis_width` truncates it to 13 (`:6044-6046`).
  const ELLIPSIS_ADVANCE_PX = 13.0625;
  const ELLIPSIS_WIDTH_PX = 13;
  const WIDTH_PX = 100;
  /** The cut falls in the second word, so the kept glyphs hold the one space. */
  const SPACE_THEN_LETTERS = 'AAA AAAAAAAAAAAAA';
  const ellipsisFlags = overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS);

  function trimFilled(text: string, justificationFlags: number, flags = ellipsisFlags) {
    const options = { fontMetrics: OPEN_SANS_FONT_METRICS, fontSizePx: FONT_SIZE_PX };
    return trimLine(line(text), WIDTH_PX, flags, options, filledPlacement(justificationFlags));
  }

  it('grows a space the cut keeps until the ellipsis ends at the width', () => {
    const ellipsis = trimFilled(SPACE_THEN_LETTERS, JustificationFlag.WORD_BOUND).glyphs.at(-1)!;
    expect(ellipsis.x).toBe(WIDTH_PX - ELLIPSIS_WIDTH_PX);
  });

  it('keeps the width Godot aligns by, the kept advance plus the truncated ellipsis', () => {
    const plain = trim(SPACE_THEN_LETTERS, WIDTH_PX, ellipsisFlags);
    expect(trimFilled(SPACE_THEN_LETTERS, JustificationFlag.WORD_BOUND).widthPx).toBe(plain.widthPx);
  });

  it('leaves the glyphs as the trim placed them without WORD_BOUND', () => {
    expect(trimFilled(SPACE_THEN_LETTERS, 0)).toEqual(trim(SPACE_THEN_LETTERS, WIDTH_PX, ellipsisFlags));
  });

  it('leaves a cut that keeps no space as the trim placed it', () => {
    expect(trimFilled('AAAAAAAAAAAAAAAA', JustificationFlag.WORD_BOUND)).toEqual(
      trim('AAAAAAAAAAAAAAAA', WIDTH_PX, ellipsisFlags)
    );
  });

  it('keeps every glyph when only an enforced ellipsis draws (trim_pos < 0, `:5582`)', () => {
    const enforced = { ...ellipsisFlags, enforceEllipsis: true };
    expect(trimFilled('A B', JustificationFlag.WORD_BOUND, enforced)).toEqual(
      trim('A B', WIDTH_PX, enforced)
    );
  });

  it('grows the spaces of a right-to-left line from its visual left, after the ellipsis', () => {
    const hebrew = 'אבג דהו זחט יכל מנס עפצ קרש';
    const filled = trimFilled(hebrew, JustificationFlag.WORD_BOUND);
    const last = filled.glyphs.at(-1)!;
    expect(filled.glyphs[0]!.char).toBe('…');
    expect(last.x + last.advance).toBeCloseTo(WIDTH_PX + (ELLIPSIS_ADVANCE_PX - ELLIPSIS_WIDTH_PX), 9);
  });
});

// :5984-6036: the dots and the space come from the last glyph's font, else the first font of the span that has them.
describe('trimLine — the ellipsis from a fallback chain', () => {
  const ELLIPSIS_ONLY = { ...OPEN_SANS_FONT_METRICS, hasGlyph: (ch: string) => ch === '…' };
  const NO_ELLIPSIS = { ...OPEN_SANS_FONT_METRICS, hasGlyph: (ch: string) => ch !== '…' };

  function trimIn(fontMetrics: typeof OPEN_SANS_FONT_METRICS) {
    const shaped = shapeText('AAAAAAAAAAAA', {
      fontSizePx: FONT_SIZE_PX,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      lineSpacingPx: 0,
      fontMetrics,
    }).lines[0]!;
    const flags = overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS);
    return trimLine(shaped, 100, flags, { fontMetrics, fontSizePx: FONT_SIZE_PX }, inferredPlacement);
  }

  it('draws the ellipsis from the first fallback that has it', () => {
    const glyphs = trimIn({ ...NO_ELLIPSIS, fallbacks: [ELLIPSIS_ONLY] }).glyphs;
    expect(glyphs.at(-1)!.char).toBe('…');
    expect(glyphs.at(-1)!.fontMetrics).toBe(ELLIPSIS_ONLY);
  });

  it('draws three dots where no font of the chain has the ellipsis', () => {
    expect(drawnText(trimIn({ ...NO_ELLIPSIS, fallbacks: [NO_ELLIPSIS] })).endsWith('...')).toBe(true);
  });
});

describe('trimLine — a base and its mark (text_server_adv.cpp:6073)', () => {
  /** The Hebrew line with a zero-advance mark after its visually left glyph, in that glyph's cluster. */
  function lineWithMark(): TextLineLayout {
    const shaped = line(HEBREW);
    const [base, ...rest] = shaped.glyphs;
    const mark = { ...base!, char: 'ָ', x: base!.x + base!.advance, advance: 0 };
    return { ...shaped, glyphs: [base!, mark, ...rest] };
  }

  it('cuts before the cluster, not between the base and the mark', () => {
    const marked = lineWithMark();
    const [base] = marked.glyphs;
    const result = trimLine(
      marked,
      marked.widthPx - base!.advance,
      overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_CHAR),
      { fontMetrics: OPEN_SANS_FONT_METRICS, fontSizePx: FONT_SIZE_PX },
      inferredPlacement
    );
    expect(result.glyphs.filter((glyph) => glyph.sourceIndex === base!.sourceIndex)).toEqual([]);
  });

  it('takes a right-to-left mark with an advance off the width it walks past (text_server_adv.cpp:6106-6108)', () => {
    const shaped = line(HEBREW);
    const [base, ...rest] = shaped.glyphs;
    const mark = { ...base!, char: 'ָ', x: base!.x + base!.advance };
    const marked = { ...shaped, glyphs: [base!, mark, ...rest], widthPx: shaped.widthPx + mark.advance };
    // A hair over the width without the cluster, so rounding cannot push the cut one cluster on.
    const withoutClusterPx = marked.widthPx - base!.advance - mark.advance + 0.001;

    const result = trimLine(
      marked,
      withoutClusterPx,
      overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_CHAR),
      { fontMetrics: OPEN_SANS_FONT_METRICS, fontSizePx: FONT_SIZE_PX },
      inferredPlacement
    );

    expect(result.glyphs.map((glyph) => glyph.sourceIndex)).toEqual(rest.map((glyph) => glyph.sourceIndex));
  });
});

function shaped(text: string) {
  return shapeText(text, {
    fontSizePx: FONT_SIZE_PX,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 0,
  });
}

const SOLO_OPTIONS = { fontMetrics: OPEN_SANS_FONT_METRICS, fontSizePx: FONT_SIZE_PX };

describe('trimSoloLine', () => {
  it('returns the same layout when the behaviour does not trim', () => {
    const layout = shaped('AAAAAAAA');
    expect(
      trimSoloLine(layout, overrunFlagsForBehavior(OverrunBehavior.OVERRUN_NO_TRIMMING), 20, SOLO_OPTIONS)
    ).toBe(layout);
  });

  it('returns the same layout when the line fits', () => {
    const layout = shaped('A');
    expect(
      trimSoloLine(layout, overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS), 100, SOLO_OPTIONS)
    ).toBe(layout);
  });

  it('cuts an overlong line to the width as a text buffer trim does', () => {
    const layout = shaped('AAAAAAAA');
    const flags = overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS);
    const trimmed = trimSoloLine(layout, flags, 40, SOLO_OPTIONS);
    expect(trimmed.lines).toEqual([trimLine(layout.lines[0]!, 40, flags, SOLO_OPTIONS, inferredPlacement)]);
    expect(trimmed.widthPx).toBe(trimmed.lines[0]!.widthPx);
  });

  it("keeps the line's underline, which a trim does not reshape", () => {
    const layout = shaped('AAAAAAAA');
    const trimmed = trimSoloLine(
      layout,
      overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS),
      40,
      SOLO_OPTIONS
    );
    expect(trimmed.lines[0]!.underline).toEqual({ positionPx: 0.984375, thicknessPx: 0.390625 });
  });
});

describe('isTextWidthClipped', () => {
  it('is false with no clip_text and no trimming overrun', () => {
    expect(isTextWidthClipped({})).toBe(false);
    expect(isTextWidthClipped({ overrunBehavior: OverrunBehavior.OVERRUN_NO_TRIMMING })).toBe(false);
  });

  it('is true under clip_text', () => {
    expect(isTextWidthClipped({ clipText: true })).toBe(true);
  });

  it('is true under a trimming overrun behaviour', () => {
    expect(isTextWidthClipped({ overrunBehavior: OverrunBehavior.OVERRUN_TRIM_CHAR })).toBe(true);
  });
});

describe("trimLayoutToWidth — the layout's drawn direction (text_server.cpp:1744)", () => {
  const ELLIPSIS = overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS);
  const shapedIn = (direction: number) =>
    shapeText(HEBREW, {
      fontSizePx: FONT_SIZE_PX,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      lineSpacingPx: 0,
      direction,
    });
  const trimmedRow = (direction: number) => {
    const layout = shapedIn(direction);
    return trimLayoutToWidth(layout, layout.widthPx * 0.75, ELLIPSIS, SOLO_OPTIONS).lines[0]!;
  };

  it('draws the fill of a layout set RTL in its inferred order, with no second outline set', () => {
    expect(trimmedRow(TextDirection.TEXT_DIRECTION_RTL).outlineGlyphs).toBeUndefined();
  });

  it('draws the fill of an AUTO layout that infers RTL left to right, with the outline apart', () => {
    expect(trimmedRow(TextDirection.TEXT_DIRECTION_AUTO).outlineGlyphs).toBeDefined();
  });

  it('keeps the drawn direction of a solo line it trims', () => {
    const layout = shapedIn(TextDirection.TEXT_DIRECTION_RTL);
    expect(trimSoloLine(layout, ELLIPSIS, layout.widthPx * 0.75, SOLO_OPTIONS).isDrawnRtl).toBe(true);
  });
});

describe('trimLine — the placement of what a trim keeps', () => {
  const ELLIPSIS = overrunFlagsForBehavior(OverrunBehavior.OVERRUN_TRIM_ELLIPSIS);
  const OPTIONS = { fontMetrics: OPEN_SANS_FONT_METRICS, fontSizePx: FONT_SIZE_PX };

  it('places a text buffer set RTL as the inferred placement does', () => {
    const full = line(HEBREW);
    expect(trimLine(full, full.widthPx * 0.75, ELLIPSIS, OPTIONS, textBufferPlacement(true))).toEqual(
      trimLine(full, full.widthPx * 0.75, ELLIPSIS, OPTIONS, inferredPlacement)
    );
  });

  it('places a FILL line without WORD_BOUND as the inferred placement does', () => {
    const full = line('AAA AAAAAAAAAAAAA');
    expect(trimLine(full, 100, ELLIPSIS, OPTIONS, filledPlacement(0))).toEqual(
      trimLine(full, 100, ELLIPSIS, OPTIONS, inferredPlacement)
    );
  });

  it('returns a line that fits as it is, whatever the placement', () => {
    const full = line(HEBREW);
    expect(trimLine(full, full.widthPx + 1, ELLIPSIS, OPTIONS, textBufferPlacement(false))).toBe(full);
  });
});
