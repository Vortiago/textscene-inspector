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
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext, MinimumSizeResult } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { shapeText, AutowrapMode, type TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import { getFontAscentPx } from '../../../../r3f/controls/native/text/fontMetrics';
import { OPEN_SANS_FONT_METRICS } from '../../../../r3f/controls/native/text/openSansFontMetrics';
import type { FontResource } from '../../../../resources/fonts/font/types';
import type { ThemeResource } from '../../../../resources/styles/theme/types';
import * as logger from '../../../../logger';
import * as resolveNodeFontMetricsModule from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';
import type { RichTextLabelProperties } from './types';
import {
  richTextLabelMinimumSize,
  RICH_TEXT_LABEL_THEME_KEYS,
  RICH_TEXT_LABEL_DEFAULT_FONT_COLOR,
  RICH_TEXT_LABEL_THEME_FONT_KEY,
  richTextLabelTextTheme,
  styledTextRuns,
  fontSizePxAtFromRuns,
  layoutRichTextRuns,
  richTextLineMetrics,
  richTextUnderlineMetrics,
  underlineRectPx,
  BOLD_DISTANCE_BIAS,
  ITALIC_SKEW,
  RICH_TEXT_LABEL_UNDERLINE_ALPHA,
} from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function node(props: Partial<RichTextLabelProperties>, overrides: Partial<SolveNode> = {}): SolveNode {
  return {
    ...solveNode(),
    path: 'RTL',
    node: { name: 'RTL', type: 'RichTextLabel', children: [], properties: { name: 'RTL', ...props } as ControlProperties },
    ...overrides,
  };
}

/** `richTextLabelMinimumSize`'s `size` half only — see `MinimumSizeResult`'s own doc for why the union is here at all. */
function size(result: Vec2 | MinimumSizeResult): Vec2 {
  return 'x' in result ? result : result.size;
}

function ctx(withMeasurer = true): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: withMeasurer ? measureText : null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

// 'A's hmtx advance width is 1354 design units (openSansMetrics.ts's
// CONTINUOUS advanceWidths, NOT openSansAtlas.ts's atlas-bake-resolution-42
// xadvance). 'B's is 1350 design units, DIFFERENT from 'A's 1354 — the
// two only coincided at the OLD atlas-bake-resolution-42 xadvance (both
// rounded to the integer 28), not a fact about the font.
const AB_WIDTH = (1354 + 1350) * (16 / 2048); // 21.125
// The SHAPED size of 'AB' — `TS->shaped_text_get_size(...).x` ceils the pen
// advance to a whole pixel (`text_server_adv.cpp:7524-7537`), and every
// minimum size below is built from that, not from the fractional sum.
const AB_SHAPED_WIDTH = Math.ceil(AB_WIDTH); // 22
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
    const result = size(richTextLabelMinimumSize(node({ fitContent: true, text: 'AB', autowrapMode: 0 }), ctx()));
    expect(result.x).toBeCloseTo(AB_SHAPED_WIDTH, 6);
    expect(result.y).toBe(OWN_LINE_PITCH);
  });

  it('fit_content + autowrap OFF + explicit hard break: height is N*23 with NO trailing subtraction (2*23=46, not Label\'s 2*26-3=49)', () => {
    const result = size(richTextLabelMinimumSize(node({ fitContent: true, text: 'A\nAB', autowrapMode: 0 }), ctx()));
    expect(result.y).toBe(2 * OWN_LINE_PITCH);
    expect(result.x).toBeCloseTo(AB_SHAPED_WIDTH, 6);
  });

  it('fit_content + default autowrap (WORD_SMART): width still floors to 1 (Size2(1, height) substitution), height still the natural single-line 23px', () => {
    const result = size(richTextLabelMinimumSize(node({ fitContent: true, text: 'AB' }), ctx()));
    expect(result.x).toBe(1);
    expect(result.y).toBe(OWN_LINE_PITCH);
  });

  it('fit_content + default autowrap + explicit hard break: height still counts both natural lines (2*23=46)', () => {
    const result = size(richTextLabelMinimumSize(node({ fitContent: true, text: 'A\nAB' }), ctx()));
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
    const result = size(
      richTextLabelMinimumSize(
        node({
          fitContent: true,
          autowrapMode: 0,
          text: 'A',
          themeOverrideFontSizes: { normal_font_size: 32 },
        }),
        ctx()
      )
    );
    // At size 32: ascentPx=ceil(2189*32/2048)=35, descentPx=ceil(600*32/2048)=10 -> ownLinePitch=45.
    expect(result.y).toBe(45);
  });

  it('a [b] span with no bold_font_size override measures at the FALLBACK size (16), not normal_font_size — the same font-size resolution styledTextRuns pins', () => {
    const result = size(
      richTextLabelMinimumSize(
        node({
          fitContent: true,
          autowrapMode: 0,
          bbcodeEnabled: true,
          text: 'A[b]A[/b]',
          themeOverrideFontSizes: { normal_font_size: 32 },
        }),
        ctx()
      )
    );
    // 'A' hmtx advance width 1354 design units, unitsPerEm 2048. Plain 'A' at
    // 32px + bold 'A' at the 16px fallback: 1354*32/2048 + 1354*16/2048 =
    // 21.15625 + 10.578125 = 31.734375 of pen advance, reported as the ceiled
    // shaped size 32 (`text_server_adv.cpp:7524-7537`).
    expect(result.x).toBe(Math.ceil(31.734375));
  });

  it('a [b] span whose bold_font_size ALSO matches normal_font_size measures as if uniformly shaped (the positive control this fix closes)', () => {
    const result = size(
      richTextLabelMinimumSize(
        node({
          fitContent: true,
          autowrapMode: 0,
          bbcodeEnabled: true,
          text: 'A[b]A[/b]',
          themeOverrideFontSizes: { normal_font_size: 32, bold_font_size: 32 },
        }),
        ctx()
      )
    );
    // Both 'A's now shape at 32px. 32 is above
    // SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE, so each advance is rounded to a
    // whole pixel with the remainder carried (text_server_adv.cpp:7079-7084):
    // 'A' quantizes to 1354/64 = 21.15625, giving 21 then
    // round(21.15625 + 0.15625) = 21, so 42 of pen advance — NOT the 42.3125
    // a continuous scale would produce. Real Godot 4.6.3 agrees:
    // `ThemeDB.fallback_font.get_string_size("AA", HORIZONTAL_ALIGNMENT_LEFT,
    // -1, 32).x` is 42.
    expect(result.x).toBe(42);
  });
});

describe(`richTextLabelMinimumSize — resolves this RichTextLabel's own PARAGRAPH theme font key ("${RICH_TEXT_LABEL_THEME_FONT_KEY}", default_theme.cpp:1194)`, () => {
  // See `resolveNodeFontMetrics.test.ts`'s own doc for why an UNRESOLVABLE
  // font's warn is the observable proof here, not a resolved FontMetrics value.
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('a theme_override_fonts/normal_font local override is fed to the text engine (fit_content required for the shape branch to run at all)', () => {
    const systemFont: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const n: SolveNode = {
      ...node({ fitContent: true, text: 'A' }),
      fontOverrides: { [RICH_TEXT_LABEL_THEME_FONT_KEY]: systemFont },
    };
    richTextLabelMinimumSize(n, ctx());
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('a local override under a different key ("font", Label/Button/etc\'s own key) is not consulted', () => {
    const systemFont: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const n: SolveNode = { ...node({ fitContent: true, text: 'A' }), fontOverrides: { font: systemFont } };
    richTextLabelMinimumSize(n, ctx());
    expect(warnSpy).not.toHaveBeenCalled();
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
    const resolved = richTextLabelTextTheme(node({}), { name: 'RTL' } as RichTextLabelProperties, { theme: nativeTheme(1) });
    expect(resolved).toEqual({ fontSizePx: 16, color: RICH_TEXT_LABEL_DEFAULT_FONT_COLOR });
  });

  it("(edge) walks the ancestor Theme chain for normal_font_size, same as every other widget's resolveTextTheme (Control::get_theme_font_size, control.cpp:3107-3129)", () => {
    const theme: ThemeResource = {
      defaultFont: null,
      defaultFontSize: 30,
      fonts: {},
      fontSizes: {},
      typeVariations: {},
      properties: {},
    };
    const resolved = richTextLabelTextTheme(
      node({}, { themeChain: [theme] }),
      { name: 'RTL' } as RichTextLabelProperties,
      { theme: nativeTheme(1) }
    );
    expect(resolved.fontSizePx).toBe(30);
  });
});

describe('styledTextRuns', () => {
  const WHITE = { r: 1, g: 1, b: 1, a: 1 };
  // Distinct from the fallback (16) below so a test failing to isolate the two
  // shows up as a wrong NUMBER, not a coincidentally-equal one.
  const NORMAL = 18;
  const FALLBACK = 16;

  it('bbcode disabled: one literal run, no styling, at normalFontSizePx, even if it contains bracket characters', () => {
    expect(styledTextRuns(node({}), { text: '[b]x[/b]', bbcodeEnabled: false } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK)).toEqual([
      { text: '[b]x[/b]', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: NORMAL },
    ]);
  });

  it('bbcode disabled + empty text: no runs', () => {
    expect(styledTextRuns(node({}), { text: '', bbcodeEnabled: false } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK)).toEqual([]);
    expect(styledTextRuns(node({}), { bbcodeEnabled: false } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK)).toEqual([]);
  });

  it('bbcode enabled: [b] and [i] set independent flags, plain runs default to the passed color and normalFontSizePx', () => {
    const runs = styledTextRuns(node({}), 
      { text: 'plain [b]bold[/b] [i]italic[/i]', bbcodeEnabled: true } as RichTextLabelProperties,
      WHITE,
      NORMAL,
      FALLBACK
    );
    expect(runs).toEqual([
      { text: 'plain ', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: NORMAL },
      { text: 'bold', bold: true, italic: false, underline: false, color: WHITE, fontSizePx: FALLBACK },
      { text: ' ', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: NORMAL },
      { text: 'italic', bold: false, italic: true, underline: false, color: WHITE, fontSizePx: FALLBACK },
    ]);
  });

  it('bbcode enabled: nested [b][i] combines both flags on one run (RTL_BOLD_ITALICS_FONT, rich_text_label.cpp:5452-5471)', () => {
    const runs = styledTextRuns(node({}), { text: '[b][i]x[/i][/b]', bbcodeEnabled: true } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK);
    expect(runs).toEqual([{ text: 'x', bold: true, italic: true, underline: false, color: WHITE, fontSizePx: FALLBACK }]);
  });

  it('bbcode enabled: [u] sets the underline flag, independent of bold/italic/color, and does NOT change font size (rich_text_label.cpp:4677 push_underline)', () => {
    const runs = styledTextRuns(node({}), 
      { text: 'plain [u]underlined[/u] [b][u]bold and underlined[/u][/b]', bbcodeEnabled: true } as RichTextLabelProperties,
      WHITE,
      NORMAL,
      FALLBACK
    );
    expect(runs).toEqual([
      { text: 'plain ', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: NORMAL },
      { text: 'underlined', bold: false, italic: false, underline: true, color: WHITE, fontSizePx: NORMAL },
      { text: ' ', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: NORMAL },
      { text: 'bold and underlined', bold: true, italic: false, underline: true, color: WHITE, fontSizePx: FALLBACK },
    ]);
  });

  it('bbcode enabled: [color=#e0a030] resolves to that RGBA, overriding the passed default; colour alone does not change font size', () => {
    const runs = styledTextRuns(node({}), 
      { text: '[color=#e0a030]x[/color]', bbcodeEnabled: true } as RichTextLabelProperties,
      WHITE,
      NORMAL,
      FALLBACK
    );
    expect(runs).toEqual([
      {
        text: 'x',
        bold: false,
        italic: false,
        underline: false,
        color: { r: 0xe0 / 255, g: 0xa0 / 255, b: 0x30 / 255, a: 1 },
        fontSizePx: NORMAL,
      },
    ]);
  });

  it('bbcode enabled: an unrecognised [color] value falls back to the passed default, not white', () => {
    const fallback = { r: 0.5, g: 0.5, b: 0.5, a: 1 };
    const runs = styledTextRuns(node({}), 
      { text: '[color=not-a-color]x[/color]', bbcodeEnabled: true } as RichTextLabelProperties,
      fallback,
      NORMAL,
      FALLBACK
    );
    expect(runs[0]!.color).toEqual(fallback);
  });

  it('bbcode enabled: drops zero-length runs (adjacent tags with nothing between)', () => {
    const runs = styledTextRuns(node({}), { text: '[b][/b][i]x[/i]', bbcodeEnabled: true } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK);
    expect(runs).toEqual([{ text: 'x', bold: false, italic: true, underline: false, color: WHITE, fontSizePx: FALLBACK }]);
  });

  describe('per-run font size (scene/theme/default_theme.cpp:1199-1202, rich_text_label.cpp:3244-3290)', () => {
    it('a [b] run with no bold_font_size override renders at the FALLBACK size (16), never at normalFontSizePx (18) — Theme::get_font_size falls to ThemeDB::get_fallback_font_size, not to a sibling key', () => {
      const runs = styledTextRuns(node({}), { text: '[b]x[/b]', bbcodeEnabled: true } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK);
      expect(runs[0]!.fontSizePx).toBe(FALLBACK);
      expect(runs[0]!.fontSizePx).not.toBe(NORMAL);
    });

    it('an [i] run with no italics_font_size override ALSO renders at the fallback size', () => {
      const runs = styledTextRuns(node({}), { text: '[i]x[/i]', bbcodeEnabled: true } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK);
      expect(runs[0]!.fontSizePx).toBe(FALLBACK);
    });

    it('an explicit bold_font_size override wins over the fallback', () => {
      const runs = styledTextRuns(node({}), 
        {
          name: 'RTL',
          text: '[b]x[/b]',
          bbcodeEnabled: true,
          themeOverrideFontSizes: { bold_font_size: 24 },
        },
        WHITE,
        NORMAL,
        FALLBACK
      );
      expect(runs[0]!.fontSizePx).toBe(24);
    });

    it('a scene that ALSO overrides bold_font_size to match normal_font_size closes the gap (the fixture used to prove this against real Godot)', () => {
      const runs = styledTextRuns(node({}), 
        {
          name: 'RTL',
          text: '[b]x[/b]',
          bbcodeEnabled: true,
          themeOverrideFontSizes: { bold_font_size: NORMAL },
        },
        WHITE,
        NORMAL,
        FALLBACK
      );
      expect(runs[0]!.fontSizePx).toBe(NORMAL);
    });

    it('an italics_font_size override applies only to italic-only runs, not to bold-only ones', () => {
      const runs = styledTextRuns(node({}), 
        {
          name: 'RTL',
          text: '[b]x[/b][i]y[/i]',
          bbcodeEnabled: true,
          themeOverrideFontSizes: { italics_font_size: 20 },
        },
        WHITE,
        NORMAL,
        FALLBACK
      );
      expect(runs[0]!.fontSizePx).toBe(FALLBACK); // [b], no bold_font_size override.
      expect(runs[1]!.fontSizePx).toBe(20); // [i], honours italics_font_size.
    });

    it('[b][i] combined reads bold_italics_font_size, NOT bold_font_size or italics_font_size', () => {
      const runs = styledTextRuns(node({}), 
        {
          name: 'RTL',
          text: '[b][i]x[/i][/b]',
          bbcodeEnabled: true,
          themeOverrideFontSizes: { bold_font_size: 20, italics_font_size: 22, bold_italics_font_size: 30 },
        },
        WHITE,
        NORMAL,
        FALLBACK
      );
      expect(runs[0]!.fontSizePx).toBe(30);
    });

    it("(edge) a [b] run's fallback ALSO walks the ancestor Theme chain — the SAME ancestor default_font_size a themed normal run resolves to, not just this previewer's flat built-in default. Otherwise a themed RichTextLabel's [b] text would diverge from its own normal text in a way real Godot never does (Theme::get_font_size, theme.cpp:658-666)", () => {
      const theme: ThemeResource = {
        defaultFont: null,
        defaultFontSize: 30,
        fonts: {},
        fontSizes: {},
        typeVariations: {},
        properties: {},
      };
      const runs = styledTextRuns(
        node({}, { themeChain: [theme] }),
        { text: '[b]x[/b]', bbcodeEnabled: true } as RichTextLabelProperties,
        WHITE,
        NORMAL,
        FALLBACK
      );
      expect(runs[0]!.fontSizePx).toBe(30);
    });

    it("(edge) an ancestor theme's OWN <RichTextLabel>/font_sizes/bold_font_size entry wins over its default_font_size — the SAME specific-before-default order every other ancestor walk in this codebase follows", () => {
      const theme: ThemeResource = {
        defaultFont: null,
        defaultFontSize: 30,
        fonts: {},
        fontSizes: { RichTextLabel: { bold_font_size: 40 } },
        typeVariations: {},
        properties: {},
      };
      const runs = styledTextRuns(
        node({}, { themeChain: [theme] }),
        { text: '[b]x[/b]', bbcodeEnabled: true } as RichTextLabelProperties,
        WHITE,
        NORMAL,
        FALLBACK
      );
      expect(runs[0]!.fontSizePx).toBe(40);
    });

    it('(edge) a node-local bold_font_size override still wins over the ancestor theme entirely, unchanged from the non-ancestor case above', () => {
      const theme: ThemeResource = {
        defaultFont: null,
        defaultFontSize: 30,
        fonts: {},
        fontSizes: {},
        typeVariations: {},
        properties: {},
      };
      const runs = styledTextRuns(
        node({}, { themeChain: [theme] }),
        {
          name: 'RTL',
          text: '[b]x[/b]',
          bbcodeEnabled: true,
          themeOverrideFontSizes: { bold_font_size: 24 },
        },
        WHITE,
        NORMAL,
        FALLBACK
      );
      expect(runs[0]!.fontSizePx).toBe(24);
    });
  });

  describe('memoises the per-key ancestor-Theme walk within one call — only 3 distinct style keys exist (bold_font_size/italics_font_size/bold_italics_font_size), so a label with many styled spans must not re-walk once per span', () => {
    let sizeSpy: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
      sizeSpy = vi.spyOn(resolveNodeFontMetricsModule, 'resolveNodeFontSizePx');
    });
    afterEach(() => {
      sizeSpy.mockRestore();
    });

    it('five [b] spans walk bold_font_size ONCE, not five times', () => {
      const text = '[b]a[/b][b]b[/b][b]c[/b][b]d[/b][b]e[/b]';
      styledTextRuns(node({}), { text, bbcodeEnabled: true } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK);
      expect(sizeSpy).toHaveBeenCalledTimes(1);
      expect(sizeSpy).toHaveBeenCalledWith(expect.anything(), 'bold_font_size', undefined, FALLBACK);
    });

    it('bold/italic/bold+italic spans, each repeated, walk their own key ONCE each — 3 calls total, not 6', () => {
      const text = '[b]a[/b][i]b[/i][b][i]c[/i][/b][b]d[/b][i]e[/i][b][i]f[/i][/b]';
      const runs = styledTextRuns(node({}), { text, bbcodeEnabled: true } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK);
      // Correctness is unaffected by memoising — still 6 runs, still resolved individually.
      expect(runs).toHaveLength(6);
      expect(sizeSpy).toHaveBeenCalledTimes(3);
      const keys = sizeSpy.mock.calls.map((call: unknown[]) => call[1]).sort();
      expect(keys).toEqual(['bold_font_size', 'bold_italics_font_size', 'italics_font_size']);
    });
  });
});

describe('fontSizePxAtFromRuns', () => {
  it('maps each character index to its OWN run\'s fontSizePx, in concatenation order', () => {
    const runs = [
      { text: 'ab', bold: false, italic: false, underline: false, color: { r: 1, g: 1, b: 1, a: 1 }, fontSizePx: 18 },
      { text: 'CD', bold: true, italic: false, underline: false, color: { r: 1, g: 1, b: 1, a: 1 }, fontSizePx: 16 },
    ];
    const sizeAt = fontSizePxAtFromRuns(runs);
    expect(sizeAt(0)).toBe(18);
    expect(sizeAt(1)).toBe(18);
    expect(sizeAt(2)).toBe(16);
    expect(sizeAt(3)).toBe(16);
  });

  it('an out-of-range index (shapeText\'s own trailing terminator glyph) falls back to the LAST run\'s size rather than throwing', () => {
    const runs = [{ text: 'a', bold: false, italic: false, underline: false, color: { r: 1, g: 1, b: 1, a: 1 }, fontSizePx: 18 }];
    expect(fontSizePxAtFromRuns(runs)(1)).toBe(18);
  });

  it('is 0 for a totally empty run list — nothing to index, never NaN/undefined leaking into shapeText', () => {
    expect(fontSizePxAtFromRuns([])(0)).toBe(0);
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

  it(
    'BOLD_DISTANCE_BIAS is tuned to a real Godot 4.6.3 measurement, not the earlier unmeasured 0.08 placeholder — ' +
      "pnpm ref:godot on unit-rich-text-label.tscn's [b]Bold[/b] span, a horizontal transect through the 'l' " +
      "stem's half-max crossings, reads 3.04px there; 0.35 is the bias this module's own doc pins as reproducing " +
      "that (own doc has the full worked measurement)",
    () => {
      expect(BOLD_DISTANCE_BIAS).toBe(0.35);
    }
  );
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

  /** `shape`, but with each character shaped at ITS run's own size — the only way a wrapped line can end up carrying a font size the paragraph's own key never mentions. */
  function shapeMixed(
    text: string,
    runs: Parameters<typeof fontSizePxAtFromRuns>[0],
    boxWidthPx = 0,
    autowrapMode = AutowrapMode.OFF
  ): TextLayoutResult {
    return shapeText(text, {
      fontSizePx: FONT_SIZE,
      boxWidthPx,
      autowrapMode,
      lineSpacingPx: 0,
      fontSizePxAt: fontSizePxAtFromRuns(runs),
    });
  }

  it('returns no placements for empty text (one line, zero glyphs, nothing to attribute)', () => {
    expect(layoutRichTextRuns([], shape(''))).toEqual([]);
  });

  it('a single run spanning one whole (unwrapped) line produces exactly one placement carrying every glyph', () => {
    const runs = [{ text: 'AB', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE }];
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
      { text: 'plain', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE },
      { text: 'BOLD', bold: true, italic: false, underline: false, color: BLACK, fontSizePx: FONT_SIZE },
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
      { text: 'plain', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE },
      { text: 'ULINE', bold: false, italic: false, underline: true, color: WHITE, fontSizePx: FONT_SIZE },
    ];
    const layout = shape('plainULINE');
    const placements = layoutRichTextRuns(runs, layout);
    expect(placements).toHaveLength(2);
    expect(placements[0]!.underline).toBe(false);
    expect(placements[1]!.underline).toBe(true);
  });

  it('a single run whose text WRAPS across two lines produces one placement per line, same style on both', () => {
    const runs = [{ text: 'AAAA BBBB', bold: true, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE }];
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
      { text: 'AAAA ', bold: true, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE },
      { text: 'BBBB', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE },
    ];
    const layout = shape('AAAA BBBB', 60, AutowrapMode.WORD);
    const placements = layoutRichTextRuns(runs, layout);
    // Every placement's glyphs come from exactly one of the two runs.
    for (const p of placements) {
      const chars = p.layout.lines[0]!.glyphs.map((g) => g.char).join('');
      expect(chars === 'AAAA' || chars === 'BBBB').toBe(true);
    }
  });

  it("carries each run's OWN fontSizePx through to its placement, independent of the OTHER run's size", () => {
    const runs = [
      { text: 'plain', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: 18 },
      { text: 'BOLD', bold: true, italic: false, underline: false, color: WHITE, fontSizePx: 16 },
    ];
    const layout = shape('plainBOLD');
    const placements = layoutRichTextRuns(runs, layout);
    expect(placements[0]!.fontSizePx).toBe(18);
    expect(placements[1]!.fontSizePx).toBe(16);
  });

  it('(regression) each placement echoes the PARENT layout\'s fontMetrics/linePitchPx — TextRun.tsx dispatches paint by layout.fontMetrics.kind, so an omitted value here would silently force every run onto the atlas path', () => {
    const runs = [{ text: 'AB', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE }];
    const layout = shape('AB');
    const placements = layoutRichTextRuns(runs, layout);
    expect(placements[0]!.layout.fontMetrics).toBe(layout.fontMetrics);
    expect(placements[0]!.layout.linePitchPx).toBe(layout.linePitchPx);
  });

  it("anchors EVERY run on a line at that LINE's own baseline — the MAX ascent over the fonts on it, not each run's own — so a 16px run and an 18px run on one line share one baseline", () => {
    // `text_server_adv.cpp:5486` (`_shape_substr`):
    // `p_new_sd->ascent = MAX(p_new_sd->ascent, MAX(cached_font_ascent + ..., -gl.y_off))`
    // over the LINE's own glyphs, and `rich_text_label.cpp:1055`'s
    // `off.y += l_ascent` is applied once for the whole line — `off_step.y`
    // never varies per glyph, so both runs draw from the same baseline.
    const runs = [
      { text: 'plain', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: 18 },
      { text: 'BOLD', bold: true, italic: false, underline: false, color: WHITE, fontSizePx: 16 },
    ];
    const layout = shape('plainBOLD');
    const placements = layoutRichTextRuns(runs, layout);
    const lineAscent = getFontAscentPx(OPEN_SANS_FONT_METRICS, 18); // 20 — the larger of the two.
    expect(placements[0]!.layout.baselineOffsetPx).toBe(lineAscent);
    expect(placements[1]!.layout.baselineOffsetPx).toBe(lineAscent);
    expect(getFontAscentPx(OPEN_SANS_FONT_METRICS, 16)).not.toBe(lineAscent);
  });

  it("steps each line's own top by THAT line's ascent+descent, not one paragraph-wide pitch — a line carrying an 18px run is 26 tall where a 16px-only line is 23", () => {
    // 'AAAA' at 18 wraps onto its own line, 'BBBB' at 16 onto the next
    // (same break-point shape as the wrap fixtures above).
    const runs = [
      { text: 'AAAA ', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: 18 },
      { text: 'BBBB', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: 16 },
    ];
    const layout = shapeMixed('AAAA BBBB', runs, 60, AutowrapMode.WORD);
    expect(layout.lines).toHaveLength(2);

    // ceil(2189*18/2048)=20, ceil(600*18/2048)=6; ceil(2189*16/2048)=18, ceil(600*16/2048)=5.
    expect(richTextLineMetrics(runs, layout)).toEqual([
      { topPx: 0, ascentPx: 20, descentPx: 6 },
      { topPx: 26, ascentPx: 18, descentPx: 5 },
    ]);

    const placements = layoutRichTextRuns(runs, layout);
    expect(placements.map((p) => p.lineTopPx)).toEqual([0, 26]);
    expect(placements[0]!.layout.baselineOffsetPx).toBe(20);
    expect(placements[1]!.layout.baselineOffsetPx).toBe(18);
  });
});

describe('richTextUnderlineMetrics', () => {
  const WHITE = { r: 1, g: 1, b: 1, a: 1 };

  it("is the MAX over EVERY run in the paragraph, not the underlined run's own size — a line's shaped substring inherits the paragraph's upos/uthk verbatim (text_server_adv.cpp:5310-5311), unlike ascent/descent, which ARE recomputed per line", () => {
    const runs = [
      { text: 'big', bold: true, italic: false, underline: false, color: WHITE, fontSizePx: 18 },
      { text: 'small', bold: false, italic: false, underline: true, color: WHITE, fontSizePx: 16 },
    ];
    // -(-100 - 50/2)*18/2048 and 50*18/2048 — the 18px run's, though it is the
    // 16px run that carries [u]. The -thickness/2 term is FreeType's own
    // top-edge-to-centre conversion (sfobjs.c:1424-1425).
    expect(richTextUnderlineMetrics(runs)).toEqual({
      positionPx: 1.0986328125,
      thicknessPx: 0.439453125,
    });
  });

  it('is zero for a run-less paragraph (nothing shaped, nothing to take a MAX over — text_server_adv.cpp:4461-4462 initialises both to 0)', () => {
    expect(richTextUnderlineMetrics([])).toEqual({ positionPx: 0, thicknessPx: 0 });
  });
});

describe('underlineRectPx', () => {
  // -(-100 - 50/2)*16/2048 and 50*16/2048 — one paragraph's worth of upos/uthk at 16px.
  const METRICS_16 = { positionPx: 0.9765625, thicknessPx: 0.390625 };
  // -(-100 - 50/2)*18/2048 and 50*18/2048 — the same paragraph at 18px.
  const METRICS_18 = { positionPx: 1.0986328125, thicknessPx: 0.439453125 };
  const GLYPHS = [
    { char: 'u', x: 10, advance: 5, glyph: null },
    { char: 'l', x: 15, advance: 8, glyph: null },
  ];

  it(
    "lands the whole rule on ONE pixel row — the row Godot's own hard-edged, un-antialiased " +
      'draw_line quad covers. At a line ascent of 18 the 16px stroke centre is 18+0.9765625 and the ' +
      'quad spans 18.4765625..19.4765625 (rich_text_label.cpp:1243-1244: MAX(1.0, uth) floors ' +
      '0.390625 to a 1px width, centred on the segment), which contains exactly one pixel centre, 18.5.',
    () => {
      const rect = underlineRectPx(GLYPHS, 18, METRICS_16);
      expect(rect).not.toBeNull();
      expect(rect!.topPx).toBe(18);
      expect(rect!.heightPx).toBe(1);
    }
  );

  it('is one row LOWER at 18px, where the same quad spans 18.5986..19.5986 and the only centre inside it is 19.5 — the half-a-stroke rebase (sfobjs.c:1424-1425) is what decides which of the two rows, so dropping it moves the rule visibly', () => {
    const rect = underlineRectPx(GLYPHS, 18, METRICS_18);
    expect(rect!.topPx).toBe(19);
    expect(rect!.heightPx).toBe(1);
  });

  it("tracks the line's own baseline exactly — the same offset from it at every line ascent, the invariant a fractional line origin would break", () => {
    for (const ascentPx of [17, 18, 20, 26]) {
      expect(underlineRectPx(GLYPHS, ascentPx, METRICS_16)!.topPx).toBe(ascentPx);
    }
  });

  it('snaps a genuinely thick rule to every row its quad covers, never to a fixed 1: a 3px stroke centred at 18.9765625 spans 17.4765625..20.4765625, whose covered centres are 17.5, 18.5 and 19.5 (20.5 falls outside)', () => {
    const rect = underlineRectPx(GLYPHS, 18, { positionPx: 0.9765625, thicknessPx: 3 });
    expect(rect!.topPx).toBe(17);
    expect(rect!.heightPx).toBe(3);
  });

  it("snaps the x extent the same way — the run's first glyph pen x through its last glyph's pen x + advance, rounded out to the columns the quad's own centres fall in", () => {
    const rect = underlineRectPx(
      [
        { char: 'u', x: 10.4, advance: 4.8, glyph: null },
        { char: 'l', x: 15.2, advance: 8, glyph: null },
      ],
      18,
      METRICS_16
    );
    // ceil(10.4-0.5)=10 .. ceil(23.2-0.5)-1=22, i.e. columns 10..22 inclusive.
    expect(rect!.x0).toBe(10);
    expect(rect!.x1).toBe(23);
  });

  it('returns null for an empty glyph list (nothing to underline)', () => {
    expect(underlineRectPx([], 18, METRICS_16)).toBeNull();
  });
});

/**
 * `fit_content`'s width comes from `get_content_width`, which maxes
 * `l.text_buf->get_size().x` over the lines
 * (`rich_text_label.cpp`'s content-width accumulation) —
 * `TextParagraph::get_size` is itself a max over
 * `TS->shaped_text_get_size(lines_rid[i])` (`text_paragraph.cpp:601-608`),
 * and that accessor returns `Size2(sd->width, ...).ceil()`
 * (`text_server_adv.cpp:7524-7537`).
 *
 * Godot 4.6.3, a `fit_content` RichTextLabel with `autowrap_mode = 0` and
 * `text = "Master volume"` inside a VBoxContainer in a 1152x648 SubViewport:
 * `get_combined_minimum_size()` = (116, 23) — the same whole pixel a Label of
 * that text reports, not the 115.84375 pen advance behind it.
 */
describe('richTextLabelMinimumSize — the shaped extent is ceiled (text_server_adv.cpp:7524-7537)', () => {
  it("reports Godot's own whole-pixel 116 for a fit_content, non-wrapping 'Master volume'", () => {
    const result = size(
      richTextLabelMinimumSize(
        node({ fitContent: true, text: 'Master volume', autowrapMode: 0 }),
        ctx()
      )
    );
    expect(result.x).toBe(116);
  });

  it('leaves the 1px autowrap width floor alone — that branch never reads a shaped size', () => {
    const result = size(
      richTextLabelMinimumSize(node({ fitContent: true, text: 'Master volume', autowrapMode: 2 }), ctx())
    );
    expect(result.x).toBe(1);
  });
});
