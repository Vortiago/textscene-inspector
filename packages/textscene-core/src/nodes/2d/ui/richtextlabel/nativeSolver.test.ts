/**
 * `richTextLabelMinimumSize` vs Godot 4.6.3 (`scene/gui/rich_text_label.cpp:
 * 8036-8047`, backed by `get_content_height`/`get_content_width` at
 * `:7491-7522`). Expected numbers use the SAME vendored OpenSans_SemiBold
 * atlas/metrics worked example `label/nativeSolver.test.ts` derives from
 * (`unitsPerEm=2048`, `ascent=2189`, `descent=600`, atlas bake size 42) — an
 * independent worked example, never the implementation's own output.
 *
 * At font size 16: ascentPx=18, descentPx=5 -> RichTextLabel's OWN line pitch
 * is 23 (NOT Label's 26): `default_theme.cpp:1217` sets `line_separation` to 0
 * for RichTextLabel, unlike Label's `line_spacing=3` (`:392`), so
 * `getLinePitchPx(fontSizePx, 0)` — not the default-3 call Label uses — is
 * this widget's own per-line step.
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { shapeText, AutowrapMode, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import type { RichTextLabelProperties } from './types';
import {
  richTextLabelMinimumSize,
  RICH_TEXT_LABEL_THEME_KEYS,
  RICH_TEXT_LABEL_DEFAULT_FONT_COLOR,
  richTextLabelTextTheme,
  styledTextRuns,
  layoutRichTextRuns,
  underlineRectPx,
  BOLD_DISTANCE_BIAS,
  ITALIC_SKEW,
  RICH_TEXT_LABEL_UNDERLINE_ALPHA,
} from './nativeSolver';

function node(props: Partial<RichTextLabelProperties>): SolveNode {
  return {
    path: 'RTL',
    node: { name: 'RTL', type: 'RichTextLabel', children: [], properties: { name: 'RTL', ...props } as ControlProperties },
    children: [],
    styleBoxes: {},
    textureSize: null,
  };
}

function ctx(withMeasurer = true): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: withMeasurer ? measureText : null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

const A_ADVANCE = 28 * (16 / 42); // 10.666..., same atlas xadvance Label's own test derives.
const OWN_LINE_PITCH = 23; // getLinePitchPx(16, 0): ceil(2189*16/2048) + ceil(600*16/2048) + 0.

describe('richTextLabelMinimumSize (rich_text_label.cpp:8036-8047)', () => {
  it('is (1, 0) without fit_content, default autowrap (WORD_SMART, non-OFF floors width to 1, height never counts text at all)', () => {
    expect(richTextLabelMinimumSize(node({ text: 'a very long line indeed' }), ctx())).toEqual({ x: 1, y: 0 });
  });

  it('is (0, 0) without fit_content when autowrap is explicitly OFF', () => {
    expect(richTextLabelMinimumSize(node({ text: 'a very long line indeed', autowrapMode: 0 }), ctx())).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('is (1, 0) for empty text even WITH fit_content (get_content_height: to_line===0 short-circuits to 0, unlike Label\'s font-height-for-empty-text fallback)', () => {
    expect(richTextLabelMinimumSize(node({ fitContent: true }), ctx())).toEqual({ x: 1, y: 0 });
    expect(richTextLabelMinimumSize(node({ fitContent: true, text: '' }), ctx())).toEqual({ x: 1, y: 0 });
  });

  it('empty text + fit_content + autowrap OFF is (0, 0)', () => {
    expect(richTextLabelMinimumSize(node({ fitContent: true, text: '', autowrapMode: 0 }), ctx())).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('fit_content + autowrap OFF: width is the natural line width, height is ONE line at 23px (not 26 — no line_separation)', () => {
    const result = richTextLabelMinimumSize(node({ fitContent: true, text: 'AB', autowrapMode: 0 }), ctx());
    expect(result.x).toBeCloseTo(A_ADVANCE * 2, 6);
    expect(result.y).toBe(OWN_LINE_PITCH);
  });

  it('fit_content + autowrap OFF + explicit hard break: height is N*23 with NO trailing subtraction (2*23=46, not Label\'s 2*26-3=49)', () => {
    const result = richTextLabelMinimumSize(node({ fitContent: true, text: 'A\nAB', autowrapMode: 0 }), ctx());
    expect(result.y).toBe(2 * OWN_LINE_PITCH);
    expect(result.x).toBeCloseTo(A_ADVANCE * 2, 6);
  });

  it('fit_content + default autowrap (WORD_SMART): width still floors to 1 (Size2(1, height) substitution), height still the natural single-line 23px', () => {
    const result = richTextLabelMinimumSize(node({ fitContent: true, text: 'AB' }), ctx());
    expect(result.x).toBe(1);
    expect(result.y).toBe(OWN_LINE_PITCH);
  });

  it('fit_content + default autowrap + explicit hard break: height still counts both natural lines (2*23=46)', () => {
    const result = richTextLabelMinimumSize(node({ fitContent: true, text: 'A\nAB' }), ctx());
    expect(result.x).toBe(1);
    expect(result.y).toBe(2 * OWN_LINE_PITCH);
  });

  it('treats an absent measurer as no contribution once past the always-known fit_content/empty-text branches', () => {
    expect(richTextLabelMinimumSize(node({ fitContent: true, text: 'AB', autowrapMode: 0 }), ctx(false))).toEqual({
      x: 0,
      y: 0,
    });
  });

  it('measures the TAG-STRIPPED plain text when bbcode_enabled, not the raw markup (brackets never contribute to width)', () => {
    const tagged = richTextLabelMinimumSize(
      node({ fitContent: true, autowrapMode: 0, bbcodeEnabled: true, text: '[b]AB[/b]' }),
      ctx()
    );
    const plain = richTextLabelMinimumSize(node({ fitContent: true, autowrapMode: 0, text: 'AB' }), ctx());
    expect(tagged).toEqual(plain);
  });

  it('reads theme_override_font_sizes/normal_font_size, not the theme default, when present', () => {
    const result = richTextLabelMinimumSize(
      node({
        fitContent: true,
        autowrapMode: 0,
        text: 'A',
        themeOverrideFontSizes: { normal_font_size: 32 },
      } as Partial<RichTextLabelProperties>),
      ctx()
    );
    // At size 32: ascentPx=ceil(2189*32/2048)=35, descentPx=ceil(600*32/2048)=10 -> ownLinePitch=45.
    expect(result.y).toBe(45);
  });
});

describe('richTextLabelTextTheme / RICH_TEXT_LABEL_THEME_KEYS / RICH_TEXT_LABEL_DEFAULT_FONT_COLOR', () => {
  it('uses normal_font_size/default_color as the override keys (RichTextLabel, unlike Label\'s font_size/font_color)', () => {
    expect(RICH_TEXT_LABEL_THEME_KEYS).toEqual({ sizeKey: 'normal_font_size', colorKey: 'default_color' });
  });

  it("defaults to RichTextLabel's own opaque-white font colour (default_theme.cpp:1205)", () => {
    expect(RICH_TEXT_LABEL_DEFAULT_FONT_COLOR).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it("resolves the theme's own default font size absent an override", () => {
    const resolved = richTextLabelTextTheme({ name: 'RTL' } as RichTextLabelProperties, { theme: nativeTheme(1) });
    expect(resolved).toEqual({ fontSizePx: 16, color: RICH_TEXT_LABEL_DEFAULT_FONT_COLOR });
  });
});

describe('styledTextRuns', () => {
  const WHITE = { r: 1, g: 1, b: 1, a: 1 };

  it('bbcode disabled: one literal run, no styling, even if it contains bracket characters', () => {
    expect(styledTextRuns({ text: '[b]x[/b]', bbcodeEnabled: false } as RichTextLabelProperties, WHITE)).toEqual([
      { text: '[b]x[/b]', bold: false, italic: false, underline: false, color: WHITE },
    ]);
  });

  it('bbcode disabled + empty text: no runs', () => {
    expect(styledTextRuns({ text: '', bbcodeEnabled: false } as RichTextLabelProperties, WHITE)).toEqual([]);
    expect(styledTextRuns({ bbcodeEnabled: false } as RichTextLabelProperties, WHITE)).toEqual([]);
  });

  it('bbcode enabled: [b] and [i] set independent flags, plain runs default to the passed color', () => {
    const runs = styledTextRuns(
      { text: 'plain [b]bold[/b] [i]italic[/i]', bbcodeEnabled: true } as RichTextLabelProperties,
      WHITE
    );
    expect(runs).toEqual([
      { text: 'plain ', bold: false, italic: false, underline: false, color: WHITE },
      { text: 'bold', bold: true, italic: false, underline: false, color: WHITE },
      { text: ' ', bold: false, italic: false, underline: false, color: WHITE },
      { text: 'italic', bold: false, italic: true, underline: false, color: WHITE },
    ]);
  });

  it('bbcode enabled: nested [b][i] combines both flags on one run (RTL_BOLD_ITALICS_FONT, rich_text_label.cpp:5452-5471)', () => {
    const runs = styledTextRuns({ text: '[b][i]x[/i][/b]', bbcodeEnabled: true } as RichTextLabelProperties, WHITE);
    expect(runs).toEqual([{ text: 'x', bold: true, italic: true, underline: false, color: WHITE }]);
  });

  it('bbcode enabled: [u] sets the underline flag, independent of bold/italic/color (rich_text_label.cpp:4677 push_underline)', () => {
    const runs = styledTextRuns(
      { text: 'plain [u]underlined[/u] [b][u]bold and underlined[/u][/b]', bbcodeEnabled: true } as RichTextLabelProperties,
      WHITE
    );
    expect(runs).toEqual([
      { text: 'plain ', bold: false, italic: false, underline: false, color: WHITE },
      { text: 'underlined', bold: false, italic: false, underline: true, color: WHITE },
      { text: ' ', bold: false, italic: false, underline: false, color: WHITE },
      { text: 'bold and underlined', bold: true, italic: false, underline: true, color: WHITE },
    ]);
  });

  it('bbcode enabled: [color=#e0a030] resolves to that RGBA, overriding the passed default', () => {
    const runs = styledTextRuns(
      { text: '[color=#e0a030]x[/color]', bbcodeEnabled: true } as RichTextLabelProperties,
      WHITE
    );
    expect(runs).toEqual([
      { text: 'x', bold: false, italic: false, underline: false, color: { r: 0xe0 / 255, g: 0xa0 / 255, b: 0x30 / 255, a: 1 } },
    ]);
  });

  it('bbcode enabled: an unrecognised [color] value falls back to the passed default, not white', () => {
    const fallback = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
    const runs = styledTextRuns(
      { text: '[color=not-a-color]x[/color]', bbcodeEnabled: true } as RichTextLabelProperties,
      fallback
    );
    expect(runs[0]!.color).toEqual(fallback);
  });

  it('bbcode enabled: drops zero-length runs (adjacent tags with nothing between)', () => {
    const runs = styledTextRuns({ text: '[b][/b][i]x[/i]', bbcodeEnabled: true } as RichTextLabelProperties, WHITE);
    expect(runs).toEqual([{ text: 'x', bold: false, italic: true, underline: false, color: WHITE }]);
  });
});

describe('BOLD_DISTANCE_BIAS / ITALIC_SKEW', () => {
  it('are non-zero (a zero value would be indistinguishable from the un-styled default)', () => {
    expect(BOLD_DISTANCE_BIAS).not.toBe(0);
    expect(ITALIC_SKEW).not.toBe(0);
  });

  it('ITALIC_SKEW matches default_theme.cpp:1399/1403\'s Transform2D(1.0, 0.2, ...) shear coefficient exactly', () => {
    expect(ITALIC_SKEW).toBe(0.2);
  });
});

describe('RICH_TEXT_LABEL_UNDERLINE_ALPHA', () => {
  it("matches default_theme.cpp:1231's underline_alpha constant (50, i.e. 50%) exactly — rich_text_label.cpp:1237 multiplies it into the stroke's own alpha, on top of the run's font colour", () => {
    expect(RICH_TEXT_LABEL_UNDERLINE_ALPHA).toBe(0.5);
  });
});

describe('layoutRichTextRuns', () => {
  const FONT_SIZE = 16;
  const WHITE = { r: 1, g: 1, b: 1, a: 1 };
  const BLACK = { r: 0, g: 0, b: 0, a: 1 };

  function shape(text: string, boxWidthPx = 0, autowrapMode = AutowrapMode.OFF): TextLayoutResult {
    return shapeText(text, { fontSizePx: FONT_SIZE, boxWidthPx, autowrapMode, lineSpacingPx: 0 });
  }

  it('returns no placements for empty text (one line, zero glyphs, nothing to attribute)', () => {
    expect(layoutRichTextRuns([], shape(''))).toEqual([]);
  });

  it('a single run spanning one whole (unwrapped) line produces exactly one placement carrying every glyph', () => {
    const runs = [{ text: 'AB', bold: false, italic: false, underline: false, color: WHITE }];
    const layout = shape('AB');
    const placements = layoutRichTextRuns(runs, layout);
    expect(placements).toHaveLength(1);
    expect(placements[0]!.lineIndex).toBe(0);
    expect(placements[0]!.bold).toBe(false);
    expect(placements[0]!.color).toEqual(WHITE);
    expect(placements[0]!.layout.lines[0]!.glyphs.map((g) => g.char)).toEqual(['A', 'B']);
  });

  it('two runs on the same unwrapped line produce two placements, each carrying only its own glyphs, in source order', () => {
    const runs = [
      { text: 'plain', bold: false, italic: false, underline: false, color: WHITE },
      { text: 'BOLD', bold: true, italic: false, underline: false, color: BLACK },
    ];
    const layout = shape('plainBOLD');
    const placements = layoutRichTextRuns(runs, layout);
    expect(placements).toHaveLength(2);
    expect(placements[0]!.bold).toBe(false);
    expect(placements[0]!.layout.lines[0]!.glyphs.map((g) => g.char)).toEqual(['p', 'l', 'a', 'i', 'n']);
    expect(placements[1]!.bold).toBe(true);
    expect(placements[1]!.color).toEqual(BLACK);
    expect(placements[1]!.layout.lines[0]!.glyphs.map((g) => g.char)).toEqual(['B', 'O', 'L', 'D']);
  });

  it('carries the underline flag through per placement, independent of bold/color', () => {
    const runs = [
      { text: 'plain', bold: false, italic: false, underline: false, color: WHITE },
      { text: 'ULINE', bold: false, italic: false, underline: true, color: WHITE },
    ];
    const layout = shape('plainULINE');
    const placements = layoutRichTextRuns(runs, layout);
    expect(placements).toHaveLength(2);
    expect(placements[0]!.underline).toBe(false);
    expect(placements[1]!.underline).toBe(true);
  });

  it('a single run whose text WRAPS across two lines produces one placement per line, same style on both', () => {
    const runs = [{ text: 'AAAA BBBB', bold: true, italic: false, underline: false, color: WHITE }];
    // Narrow enough that 'AAAA' and 'BBBB' land on separate lines (see textLayout.test.ts's own break-point fixtures for this shape).
    const layout = shape('AAAA BBBB', 60, AutowrapMode.WORD);
    expect(layout.lines.length).toBeGreaterThan(1);
    const placements = layoutRichTextRuns(runs, layout);
    expect(placements).toHaveLength(layout.lines.length);
    expect(new Set(placements.map((p) => p.lineIndex))).toEqual(new Set(layout.lines.map((_, i) => i)));
    for (const p of placements) expect(p.bold).toBe(true);
  });

  it('a style change exactly at a wrap boundary keeps each line single-run (no spurious split within a line)', () => {
    const runs = [
      { text: 'AAAA ', bold: true, italic: false, underline: false, color: WHITE },
      { text: 'BBBB', bold: false, italic: false, underline: false, color: WHITE },
    ];
    const layout = shape('AAAA BBBB', 60, AutowrapMode.WORD);
    const placements = layoutRichTextRuns(runs, layout);
    // Every placement's glyphs come from exactly one of the two runs.
    for (const p of placements) {
      const chars = p.layout.lines[0]!.glyphs.map((g) => g.char).join('');
      expect(chars === 'AAAA' || chars === 'BBBB').toBe(true);
    }
  });
});

describe('underlineRectPx', () => {
  const FONT_SIZE_PX = 18;

  it(
    "computes the underline stroke's rect from the run's own first/last glyph x-extent and the " +
      "font's baseline-relative underline metrics — an independent worked example, not the " +
      'implementation recomputed: ascentPx=ceil(2189*18/2048)=20, underlinePositionPx=' +
      '-(-100)*18/2048=0.87890625, underlineThicknessPx=50*18/2048=0.439453125 (floored to the 1px ' +
      'minimum, rich_text_label.cpp:1243 MAX(1.0, uth)), so centerY=20.87890625 and the stroke spans ' +
      'centerY +/- 0.5.',
    () => {
      const glyphs = [
        { char: 'u', x: 10, advance: 5, glyph: null },
        { char: 'l', x: 15, advance: 8, glyph: null },
      ];
      const rect = underlineRectPx(glyphs, FONT_SIZE_PX);
      expect(rect).not.toBeNull();
      expect(rect!.x0).toBe(10);
      expect(rect!.x1).toBe(23);
      expect(rect!.topPx).toBeCloseTo(20.37890625, 6);
      expect(rect!.heightPx).toBeCloseTo(1, 6);
    }
  );

  it('returns null for an empty glyph list (nothing to underline)', () => {
    expect(underlineRectPx([], FONT_SIZE_PX)).toBeNull();
  });
});
