/**
 * Tests the RichTextLabel solve against `scene/gui/rich_text_label.cpp`
 * (`:8036-8047`, `:7491-7522`), with OpenSans_SemiBold (`unitsPerEm=2048`, `ascent=2189`,
 * `descent=600`, bake 42) worked by hand, never from the implementation.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
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
  resolveParagraphAlignment,
  richTextHorizontalOffsetPx,
  richTextVerticalOffsets,
  richTextLineMetrics,
  richTextUnderlineMetrics,
  underlineRectPx,
  imageSizePx,
  imageBaselineOffsetPx,
  imageObjectFontMetrics,
  richTextLabelTextureSlots,
  BOLD_DISTANCE_BIAS,
  ITALIC_SKEW,
  RICH_TEXT_LABEL_UNDERLINE_ALPHA,
  richTextTabStopsPx,
} from './nativeSolver';
import { getFontGlyphAdvancePx } from '../../../../r3f/controls/native/text/fontMetrics';
import { IMAGE_OBJECT_CHAR } from './bbcode';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

function node(props: Partial<RichTextLabelProperties>, overrides: Partial<SolveNode> = {}): SolveNode {
  return {
    ...solveNode(),
    path: 'RTL',
    node: { name: 'RTL', type: 'RichTextLabel', children: [], properties: { name: 'RTL', ...props } as ControlProperties },
    ...overrides,
  };
}

function ctx(withMeasurer = true): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: withMeasurer ? measureText : null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

// hmtx advance widths from openSansMetrics.ts, not the atlas xadvance:
// 'A' is 1354 design units and 'B' 1350.
const AB_WIDTH = (1354 + 1350) * (16 / 2048); // 21.125
// The shaped size of 'AB': `TS->shaped_text_get_size(...).x` ceils the pen
// advance (`text_server_adv.cpp:7524-7537`), and every minimum size uses it.
const AB_SHAPED_WIDTH = Math.ceil(AB_WIDTH); // 22
// getLinePitchPx(16, 0): ceil(2189*16/2048) + ceil(600*16/2048) + 0, not Label's 26:
// `default_theme.cpp:1217` sets `line_separation` 0, not Label's 3 (`:392`).
const OWN_LINE_PITCH = 23;

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
    expect(result.x).toBeCloseTo(AB_SHAPED_WIDTH, 6);
    expect(result.y).toBe(OWN_LINE_PITCH);
  });

  it('fit_content + autowrap OFF + explicit hard break: height is N*23 with NO trailing subtraction (2*23=46, not Label\'s 2*26-3=49)', () => {
    const result = richTextLabelMinimumSize(node({ fitContent: true, text: 'A\nAB', autowrapMode: 0 }), ctx());
    expect(result.y).toBe(2 * OWN_LINE_PITCH);
    expect(result.x).toBeCloseTo(AB_SHAPED_WIDTH, 6);
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

  it('fit_content + autowrap ON: the height is the text WRAPPED at the width a completed pass resolved', () => {
    // `_validate_line_caches` resizes lines at `text_rect.get_size().width - scroll_w`,
    // then calls `update_minimum_size()` under `fit_content` (`rich_text_label.cpp:3873,3880`),
    // so the height is the wrapped one. 'AB AB' at 22px per 'AB' wraps to two
    // lines in a 30px box.
    const wrapped = 
      richTextLabelMinimumSize(node({ fitContent: true, text: 'AB AB' }), {
        ...ctx(),
        tentativeRect: () => ({ x: 0, y: 0, w: 30, h: 400 }),
      })
    ;
    expect(wrapped.y).toBe(2 * OWN_LINE_PITCH);
    expect(wrapped.x).toBe(1);
  });

  it('fit_content + autowrap ON: the FIRST pass, with no resolved width yet, reports the unwrapped height', () => {
    // No `tentativeRect` answer means no completed pass: Godot's pre-resize
    // state, which keeps the exchange non-circular.
    const first = richTextLabelMinimumSize(node({ fitContent: true, text: 'AB AB' }), ctx());
    expect(first.y).toBe(OWN_LINE_PITCH);
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
    const result = 
      richTextLabelMinimumSize(
        node({
          fitContent: true,
          autowrapMode: 0,
          text: 'A',
          themeOverrideFontSizes: { normal_font_size: 32 },
        }),
        ctx()
      )
    ;
    // At size 32: ascentPx=ceil(2189*32/2048)=35, descentPx=ceil(600*32/2048)=10 -> ownLinePitch=45.
    expect(result.y).toBe(45);
  });

  it('a [b] span with no bold_font_size override measures at the FALLBACK size (16), not normal_font_size — the same font-size resolution styledTextRuns pins', () => {
    const result = 
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
    ;
    // 'A' hmtx advance width 1354 design units, unitsPerEm 2048. Plain 'A' at
    // 32px + bold 'A' at the 16px fallback: 1354*32/2048 + 1354*16/2048 =
    // 21.15625 + 10.578125 = 31.734375 of pen advance, reported as the ceiled
    // shaped size 32 (`text_server_adv.cpp:7524-7537`).
    expect(result.x).toBe(Math.ceil(31.734375));
  });

  it('a [b] span whose bold_font_size ALSO matches normal_font_size measures as if uniformly shaped (the positive control this fix closes)', () => {
    const result = 
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
    ;
    // Both 'A's shape at 32px, above SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE, so
    // each advance rounds to a whole pixel with the remainder carried
    // (text_server_adv.cpp:7079-7084): 21 + 21 = 42, not 42.3125. Godot's
    // `ThemeDB.fallback_font.get_string_size("AA", HORIZONTAL_ALIGNMENT_LEFT, -1, 32).x` is 42.
    expect(result.x).toBe(42);
  });

  it('an [img]-only paragraph floors get_minimum_size to the image\'s OWN box — width the (ceiled) advance, height its own centred ascent+descent', () => {
    const result = 
      richTextLabelMinimumSize(
        node({ fitContent: true, autowrapMode: 0, bbcodeEnabled: true, text: '[img=10x40]a.png[/img]' }),
        ctx()
      )
    ;
    // A solo image's decorated advance is exact (10), and centre/centre on an
    // image-only line (textAscent=textDescent=0) splits the 40px height evenly.
    expect(result).toEqual({ x: 10, y: 40 });
  });

  it('the SAME box, for an UNAUTHORED [img] whose 10x40 comes from SolveNode.textureSlots instead of the value form', () => {
    const result = 
      richTextLabelMinimumSize(
        node(
          { fitContent: true, autowrapMode: 0, bbcodeEnabled: true, text: '[img]a.png[/img]' },
          { textureSlots: { 'a.png': { x: 10, y: 40 } } }
        ),
        ctx()
      )
    ;
    expect(result).toEqual({ x: 10, y: 40 });
  });

  it('floors to (0, 0) for an unauthored [img] whose textureSlots has not resolved yet', () => {
    const result = 
      richTextLabelMinimumSize(
        node({ fitContent: true, autowrapMode: 0, bbcodeEnabled: true, text: '[img]a.png[/img]' }),
        ctx()
      )
    ;
    expect(result).toEqual({ x: 0, y: 0 });
  });
});

describe(`richTextLabelMinimumSize — resolves this RichTextLabel's own PARAGRAPH theme font key ("${RICH_TEXT_LABEL_THEME_FONT_KEY}", default_theme.cpp:1194)`, () => {
  // An unresolvable font's warn is the observable proof here, as
  // `resolveNodeFontMetrics.test.ts` explains.
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
  // Distinct from the fallback (16), so a failure to isolate them shows as a
  // wrong number.
  const NORMAL = 18;
  const FALLBACK = 16;

  it('bbcode disabled: one literal run, no styling, at normalFontSizePx, even if it contains bracket characters', () => {
    expect(styledTextRuns(node({}), { text: '[b]x[/b]', bbcodeEnabled: false } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK)).toEqual([
      { text: '[b]x[/b]', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: NORMAL, alignment: 0 },
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
      { text: 'plain ', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: NORMAL, alignment: 0 },
      { text: 'bold', bold: true, italic: false, underline: false, color: WHITE, fontSizePx: FALLBACK, alignment: 0 },
      { text: ' ', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: NORMAL, alignment: 0 },
      { text: 'italic', bold: false, italic: true, underline: false, color: WHITE, fontSizePx: FALLBACK, alignment: 0 },
    ]);
  });

  it('bbcode enabled: nested [b][i] combines both flags on one run (RTL_BOLD_ITALICS_FONT, rich_text_label.cpp:5452-5471)', () => {
    const runs = styledTextRuns(node({}), { text: '[b][i]x[/i][/b]', bbcodeEnabled: true } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK);
    expect(runs).toEqual([{ text: 'x', bold: true, italic: true, underline: false, color: WHITE, fontSizePx: FALLBACK, alignment: 0 }]);
  });

  it('bbcode enabled: [u] sets the underline flag, independent of bold/italic/color, and does NOT change font size (rich_text_label.cpp:4677 push_underline)', () => {
    const runs = styledTextRuns(node({}), 
      { text: 'plain [u]underlined[/u] [b][u]bold and underlined[/u][/b]', bbcodeEnabled: true } as RichTextLabelProperties,
      WHITE,
      NORMAL,
      FALLBACK
    );
    expect(runs).toEqual([
      { text: 'plain ', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: NORMAL, alignment: 0 },
      { text: 'underlined', bold: false, italic: false, underline: true, color: WHITE, fontSizePx: NORMAL, alignment: 0 },
      { text: ' ', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: NORMAL, alignment: 0 },
      { text: 'bold and underlined', bold: true, italic: false, underline: true, color: WHITE, fontSizePx: FALLBACK, alignment: 0 },
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
        alignment: 0,
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
    expect(runs).toEqual([{ text: 'x', bold: false, italic: true, underline: false, color: WHITE, fontSizePx: FALLBACK, alignment: 0 }]);
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
      // The memo changes nothing: still 6 runs, each resolved.
      expect(runs).toHaveLength(6);
      expect(sizeSpy).toHaveBeenCalledTimes(3);
      const keys = sizeSpy.mock.calls.map((call: unknown[]) => call[1]).sort();
      expect(keys).toEqual(['bold_font_size', 'bold_italics_font_size', 'italics_font_size']);
    });
  });

  describe('[img]', () => {
    it('drops the run when imageSizePx cannot resolve it — no width/height/region authored, textureSlots not (yet) resolved, same outcome a failed ResourceLoader::load gives real Godot', () => {
      const runs = styledTextRuns(node({}), { text: '[img]a.png[/img]', bbcodeEnabled: true } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK);
      expect(runs).toEqual([]);
    });

    it('resolves to the texture\'s own natural size once buildSolveTree.ts\'s walk carries it on SolveNode.textureSlots', () => {
      const n = node({}, { textureSlots: { 'a.png': { x: 64, y: 32 } } });
      const runs = styledTextRuns(n, { text: '[img]a.png[/img]', bbcodeEnabled: true } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK);
      expect(runs).toHaveLength(1);
      expect(runs[0]!.image).toEqual({
        spec: expect.objectContaining({ path: 'a.png', width: 0, height: 0 }),
        sizePx: { x: 64, y: 32 },
      });
    });

    it('resolves width×height authored on the value form, carrying it as the run — width repurposes fontSizePx (imageObjectFontMetrics doc)', () => {
      const runs = styledTextRuns(node({}), { text: '[img=40x20]a.png[/img]', bbcodeEnabled: true } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK);
      expect(runs).toHaveLength(1);
      expect(runs[0]!.text).toBe(IMAGE_OBJECT_CHAR);
      expect(runs[0]!.fontSizePx).toBe(40);
      expect(runs[0]!.image).toEqual({
        spec: expect.objectContaining({ path: 'a.png', width: 40, height: 20 }),
        sizePx: { x: 40, y: 20 },
      });
    });

    it("resolves a %-form width/height against boxWidthPx — RichTextLabel's own p_width, never a height", () => {
      const runs = styledTextRuns(node({}), { text: '[img=50%x25%]a.png[/img]', bbcodeEnabled: true } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK, 200);
      expect(runs[0]!.image!.sizePx).toEqual({ x: 100, y: 50 });
    });

    it('a %-form dimension resolves to 0 (unresolvable) when boxWidthPx is not yet known (a solve tree\'s first pass)', () => {
      const runs = styledTextRuns(node({}), { text: '[img=50%]a.png[/img]', bbcodeEnabled: true } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK);
      expect(runs).toEqual([]); // width resolves to 0, with no height and no region: unsizable.
    });

    it('an image run never carries bold/italic/underline, and its top-level color mirrors the parsed [img] color=', () => {
      const runs = styledTextRuns(
        node({}),
        { text: '[img=10x10 color=#ff0000]a.png[/img]', bbcodeEnabled: true } as RichTextLabelProperties,
        WHITE,
        NORMAL,
        FALLBACK
      );
      expect(runs[0]).toMatchObject({ bold: false, italic: false, underline: false, color: { r: 1, g: 0, b: 0, a: 1 } });
    });

    it('an image run alongside plain text keeps both, in source order', () => {
      const runs = styledTextRuns(node({}), { text: 'hi[img=10x10]a.png[/img]bye', bbcodeEnabled: true } as RichTextLabelProperties, WHITE, NORMAL, FALLBACK);
      expect(runs.map((r) => r.text)).toEqual(['hi', IMAGE_OBJECT_CHAR, 'bye']);
      expect(runs[1]!.image).toBeDefined();
      expect(runs[0]!.image).toBeUndefined();
      expect(runs[2]!.image).toBeUndefined();
    });
  });
});

describe('imageSizePx (rich_text_label.cpp:4120-4155 _get_image_size, all six branches)', () => {
  it('both dimensions given: returned verbatim', () => {
    expect(imageSizePx(40, 20, undefined)).toEqual({ x: 40, y: 20 });
  });

  it('width + a region: height keeps the REGION\'s own aspect (:4130-4134, float arithmetic)', () => {
    expect(imageSizePx(40, 0, { x: 0, y: 0, w: 80, h: 40 })).toEqual({ x: 40, y: 20 });
  });

  it('height + a region: width keeps the region\'s own aspect (:4137-4141)', () => {
    expect(imageSizePx(0, 20, { x: 0, y: 0, w: 80, h: 40 })).toEqual({ x: 40, y: 20 });
  });

  it('region only, no dimension: the region\'s own size verbatim (:4147-4149)', () => {
    expect(imageSizePx(0, 0, { x: 1, y: 2, w: 80, h: 40 })).toEqual({ x: 80, y: 40 });
  });

  it('a region with zero area (Rect2::has_area() false) is treated as no region at all', () => {
    expect(imageSizePx(0, 0, { x: 0, y: 0, w: 0, h: 40 })).toBeNull();
    expect(imageSizePx(40, 0, { x: 0, y: 0, w: 0, h: 40 })).toBeNull();
  });

  it('null when the size depends on the texture\'s own natural pixel size and naturalSize is not (yet) known — neither dimension nor a usable region (:4150-4154)', () => {
    expect(imageSizePx(0, 0, undefined)).toBeNull();
  });

  it('null for a lone width with no region and no naturalSize — the OTHER dimension needs the texture\'s natural size (:4126-4128)', () => {
    expect(imageSizePx(40, 0, undefined)).toBeNull();
  });

  it('null for a lone height with no region and no naturalSize (:4133-4135)', () => {
    expect(imageSizePx(0, 40, undefined)).toBeNull();
  });

  it('width + naturalSize, no region: height keeps the TEXTURE\'s own aspect (:4126-4128)', () => {
    expect(imageSizePx(40, 0, undefined, { x: 80, y: 40 })).toEqual({ x: 40, y: 20 });
  });

  it('height + naturalSize, no region: width keeps the texture\'s own aspect (:4133-4135)', () => {
    expect(imageSizePx(0, 20, undefined, { x: 80, y: 40 })).toEqual({ x: 40, y: 20 });
  });

  it('neither dimension nor a region, naturalSize known: the texture\'s own size verbatim (:4150-4154, p_image->get_size())', () => {
    expect(imageSizePx(0, 0, undefined, { x: 64, y: 32 })).toEqual({ x: 64, y: 32 });
  });

  it('a region always wins over naturalSize, even when both are present (region reads BEFORE naturalSize is ever consulted)', () => {
    expect(imageSizePx(0, 0, { x: 0, y: 0, w: 80, h: 40 }, { x: 999, y: 999 })).toEqual({ x: 80, y: 40 });
  });

  it('both dimensions given: naturalSize is never consulted, even when the ref never resolved', () => {
    expect(imageSizePx(40, 20, undefined, null)).toEqual({ x: 40, y: 20 });
  });
});

describe('richTextLabelTextureSlots (rich_text_label.cpp:4120-4155 _get_image_size)', () => {
  it('requests an [img] with no width/height/region — every _get_image_size branch touching naturalSize', () => {
    const n = node({ text: '[img]a.png[/img]', bbcodeEnabled: true });
    expect(richTextLabelTextureSlots(n.node)).toEqual([{ key: 'a.png', ref: 'a.png' }]);
  });

  it('does not request an [img] with both width and height authored — naturalSize is never touched (:4121-4123)', () => {
    const n = node({ text: '[img=40x20]a.png[/img]', bbcodeEnabled: true });
    expect(richTextLabelTextureSlots(n.node)).toEqual([]);
  });

  it('does not request an [img] with a region — the region substitutes for naturalSize on every branch', () => {
    const n = node({ text: '[img region=0,0,80,40]a.png[/img]', bbcodeEnabled: true });
    expect(richTextLabelTextureSlots(n.node)).toEqual([]);
  });

  it('requests a lone width with no region — the height branch still needs naturalSize (:4126-4128)', () => {
    const n = node({ text: '[img=40]a.png[/img]', bbcodeEnabled: true });
    expect(richTextLabelTextureSlots(n.node)).toEqual([{ key: 'a.png', ref: 'a.png' }]);
  });

  it('dedupes repeated refs to one request', () => {
    const n = node({ text: '[img]a.png[/img] and again [img]a.png[/img]', bbcodeEnabled: true });
    expect(richTextLabelTextureSlots(n.node)).toEqual([{ key: 'a.png', ref: 'a.png' }]);
  });

  it('requests nothing when bbcode is disabled, even with [img]-shaped text', () => {
    const n = node({ text: '[img]a.png[/img]', bbcodeEnabled: false });
    expect(richTextLabelTextureSlots(n.node)).toEqual([]);
  });

  it('requests nothing for empty/absent text', () => {
    expect(richTextLabelTextureSlots(node({ bbcodeEnabled: true }).node)).toEqual([]);
  });
});

describe('imageObjectFontMetrics — exact-advance round-trip through the SHARED fontMetrics.ts chain (getFontGlyphAdvancePx)', () => {
  const decorated = imageObjectFontMetrics(OPEN_SANS_FONT_METRICS);

  it.each([24, 100, 33.5, 21, 0, 1])(
    'shapes IMAGE_OBJECT_CHAR at "size" %dpx to an advance of exactly %dpx — getGlyphAdvanceUnits(IMAGE_OBJECT_CHAR) === unitsPerEm makes the FreeType/HarfBuzz chain (fontMetrics.ts:228-234) reduce to the requested size, rounded to the nearest 1/64px',
    (width) => {
      expect(getFontGlyphAdvancePx(decorated, IMAGE_OBJECT_CHAR, width)).toBe(width);
    }
  );

  it('never touches a real character\'s own advance — delegates to the base metrics unchanged', () => {
    expect(decorated.getGlyphAdvanceUnits('A')).toBe(OPEN_SANS_FONT_METRICS.getGlyphAdvanceUnits('A'));
  });

  it('suppresses kerning on EITHER side of IMAGE_OBJECT_CHAR, even where the base metrics would have a real pair', () => {
    expect(decorated.getKerningAdjustmentUnits(IMAGE_OBJECT_CHAR, 'A')).toBe(0);
    expect(decorated.getKerningAdjustmentUnits('A', IMAGE_OBJECT_CHAR)).toBe(0);
  });
});

describe('imageBaselineOffsetPx (TextServerAdvanced::_realign, text_server_adv.cpp:5189-5254, horizontal-orientation arm)', () => {
  const CENTER_CENTER = { imagePoint: 'center', textPoint: 'center' } as const;

  it('default alignment (center/center): the image\'s own vertical centre sits on the text box\'s own vertical centre', () => {
    // y = (-ascent+descent)/2, then -= size.y/2 (CENTER_TO).
    expect(imageBaselineOffsetPx(18, 5, 10, CENTER_CENTER)).toBe((-18 + 5) / 2 - 5);
  });

  it('top/top: the image\'s own top sits at the text\'s own ascent line (TOP_TO is a NOP, y = -ascent)', () => {
    expect(imageBaselineOffsetPx(18, 5, 10, { imagePoint: 'top', textPoint: 'top' })).toBe(-18);
  });

  it('bottom/bottom: the image\'s own bottom sits at the text\'s own descent line (y = descent, then -= size.y)', () => {
    expect(imageBaselineOffsetPx(18, 5, 10, { imagePoint: 'bottom', textPoint: 'bottom' })).toBe(5 - 10);
  });

  it('top/baseline: the image\'s own top sits ON the baseline (y = 0, TOP_TO NOP)', () => {
    expect(imageBaselineOffsetPx(18, 5, 10, { imagePoint: 'top', textPoint: 'baseline' })).toBe(0);
  });

  it('an image-only line (no text glyphs): textAscentPx/textDescentPx are both 0, so a center/center image straddles the baseline exactly h/2 either side', () => {
    const y = imageBaselineOffsetPx(0, 0, 10, CENTER_CENTER);
    expect(y).toBe(-5);
    expect(-y).toBe(10 - 10 / 2); // ascent contribution
    expect(y + 10).toBe(5); // descent contribution
  });
});

describe('fontSizePxAtFromRuns', () => {
  it('maps each character index to its OWN run\'s fontSizePx, in concatenation order', () => {
    const runs = [
      { text: 'ab', bold: false, italic: false, underline: false, color: { r: 1, g: 1, b: 1, a: 1 }, fontSizePx: 18, alignment: 0 },
      { text: 'CD', bold: true, italic: false, underline: false, color: { r: 1, g: 1, b: 1, a: 1 }, fontSizePx: 16, alignment: 0 },
    ];
    const sizeAt = fontSizePxAtFromRuns(runs);
    expect(sizeAt(0)).toBe(18);
    expect(sizeAt(1)).toBe(18);
    expect(sizeAt(2)).toBe(16);
    expect(sizeAt(3)).toBe(16);
  });

  it('an out-of-range index (shapeText\'s own trailing terminator glyph) falls back to the LAST run\'s size rather than throwing', () => {
    const runs = [{ text: 'a', bold: false, italic: false, underline: false, color: { r: 1, g: 1, b: 1, a: 1 }, fontSizePx: 18, alignment: 0 }];
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

  /** `shape`, with each character at its run's size, so a line can carry a size the paragraph key never names. */
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
    const runs = [{ text: 'AB', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE, alignment: 0 }];
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
      { text: 'plain', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE, alignment: 0 },
      { text: 'BOLD', bold: true, italic: false, underline: false, color: BLACK, fontSizePx: FONT_SIZE, alignment: 0 },
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
      { text: 'plain', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE, alignment: 0 },
      { text: 'ULINE', bold: false, italic: false, underline: true, color: WHITE, fontSizePx: FONT_SIZE, alignment: 0 },
    ];
    const layout = shape('plainULINE');
    const placements = layoutRichTextRuns(runs, layout);
    expect(placements).toHaveLength(2);
    expect(placements[0]!.underline).toBe(false);
    expect(placements[1]!.underline).toBe(true);
  });

  it('a single run whose text WRAPS across two lines produces one placement per line, same style on both', () => {
    const runs = [{ text: 'AAAA BBBB', bold: true, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE, alignment: 0 }];
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
      { text: 'AAAA ', bold: true, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE, alignment: 0 },
      { text: 'BBBB', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE, alignment: 0 },
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
      { text: 'plain', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: 18, alignment: 0 },
      { text: 'BOLD', bold: true, italic: false, underline: false, color: WHITE, fontSizePx: 16, alignment: 0 },
    ];
    const layout = shape('plainBOLD');
    const placements = layoutRichTextRuns(runs, layout);
    expect(placements[0]!.fontSizePx).toBe(18);
    expect(placements[1]!.fontSizePx).toBe(16);
  });

  it('(regression) each placement echoes the PARENT layout\'s fontMetrics/linePitchPx — TextRun.tsx dispatches paint by layout.fontMetrics.kind, so an omitted value here would silently force every run onto the atlas path', () => {
    const runs = [{ text: 'AB', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE, alignment: 0 }];
    const layout = shape('AB');
    const placements = layoutRichTextRuns(runs, layout);
    expect(placements[0]!.layout.fontMetrics).toBe(layout.fontMetrics);
    expect(placements[0]!.layout.linePitchPx).toBe(layout.linePitchPx);
  });

  it("anchors EVERY run on a line at that LINE's own baseline — the MAX ascent over the fonts on it, not each run's own — so a 16px run and an 18px run on one line share one baseline", () => {
    // `text_server_adv.cpp:5486` (`_shape_substr`):
    // `p_new_sd->ascent = MAX(p_new_sd->ascent, MAX(cached_font_ascent + ..., -gl.y_off))`
    // over the line's glyphs, and `rich_text_label.cpp:1055`'s `off.y += l_ascent`
    // applies once per line, so both runs share one baseline.
    const runs = [
      { text: 'plain', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: 18, alignment: 0 },
      { text: 'BOLD', bold: true, italic: false, underline: false, color: WHITE, fontSizePx: 16, alignment: 0 },
    ];
    const layout = shape('plainBOLD');
    const placements = layoutRichTextRuns(runs, layout);
    const lineAscent = getFontAscentPx(OPEN_SANS_FONT_METRICS, 18); // 20, the larger of the two.
    expect(placements[0]!.layout.baselineOffsetPx).toBe(lineAscent);
    expect(placements[1]!.layout.baselineOffsetPx).toBe(lineAscent);
    expect(getFontAscentPx(OPEN_SANS_FONT_METRICS, 16)).not.toBe(lineAscent);
  });

  it("steps each line's own top by THAT line's ascent+descent, not one paragraph-wide pitch — a line carrying an 18px run is 26 tall where a 16px-only line is 23", () => {
    // 'AAAA' at 18 wraps onto its own line, 'BBBB' at 16 onto the next
    // (same break-point shape as the wrap fixtures above).
    const runs = [
      { text: 'AAAA ', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: 18, alignment: 0 },
      { text: 'BBBB', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: 16, alignment: 0 },
    ];
    const layout = shapeMixed('AAAA BBBB', runs, 60, AutowrapMode.WORD);
    expect(layout.lines).toHaveLength(2);

    // ceil(2189*18/2048)=20, ceil(600*18/2048)=6; ceil(2189*16/2048)=18, ceil(600*16/2048)=5.
    expect(richTextLineMetrics(runs, layout)).toEqual([
      { topPx: 0, ascentPx: 20, descentPx: 6, textAscentPx: 20, textDescentPx: 6 },
      { topPx: 26, ascentPx: 18, descentPx: 5, textAscentPx: 18, textDescentPx: 5 },
    ]);

    const placements = layoutRichTextRuns(runs, layout);
    expect(placements.map((p) => p.lineTopPx)).toEqual([0, 26]);
    expect(placements[0]!.layout.baselineOffsetPx).toBe(20);
    expect(placements[1]!.layout.baselineOffsetPx).toBe(18);
  });

  // `_draw_line` measures `text_buf->get_line_size(line).x` (`rich_text_label.cpp:984`,
  // `text_paragraph.cpp:773-779`), `Size2(sd->width, ...).ceil()` (`text_server_adv.cpp:7524-7537`).
  // The box is an `int p_width` (`rich_text_label.h:672,678`), so only a
  // fractional box width tells the ceiled measure from the raw one.
  describe('line measure (rich_text_label.cpp:984,1000-1014)', () => {
    // "Threat level" at 16px: raw pen advance 91.03125, ceiled 92, both from the
    // running engine (`textLayout.test.ts`'s advance table).
    const TEXT = 'Threat level';
    const BOX_WIDTH_PX = 201.5;

    function offsetAt(alignment: number): number {
      const runs = [{ text: TEXT, bold: false, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE, alignment }];
      const layout = shape(TEXT);
      expect(layout.lines[0]!.widthPx).toBe(91.03125);
      const placements = layoutRichTextRuns(runs, layout, { boxWidthPx: BOX_WIDTH_PX, boxHeightPx: 40, horizontalAlignment: alignment });
      return placements[0]!.lineOffsetXPx;
    }

    it('RIGHT lands at `width - length` with BOTH terms whole - trunc(201.5) - ceil(91.03125) = 109, not floor(201.5 - 91.03125)', () => {
      expect(offsetAt(2)).toBe(109);
    });

    it('CENTER lands at `Math::floor((width - length) / 2.0)` over those same whole terms - floor((201 - 92) / 2) = 54', () => {
      expect(offsetAt(1)).toBe(54);
    });
  });
  describe('[img]', () => {
    const CENTER_CENTER = { imagePoint: 'center', textPoint: 'center' } as const;

    function imageRun(widthPx: number, heightPx: number, path = 'a.png') {
      return {
        text: IMAGE_OBJECT_CHAR,
        bold: false,
        italic: false,
        underline: false,
        color: WHITE,
        fontSizePx: widthPx, // carries the width: imageObjectFontMetrics.
        alignment: 0,
        image: { spec: { path, width: widthPx, height: heightPx, widthInPercent: false, heightInPercent: false, color: WHITE, region: undefined, pad: false, tooltip: '', altText: '', alignment: CENTER_CENTER }, sizePx: { x: widthPx, y: heightPx } },
      };
    }

    /** `shape`, decorated so an image placeholder shapes at the image width, as Component.tsx does. */
    function shapeWithImages(text: string, runs: Parameters<typeof fontSizePxAtFromRuns>[0], boxWidthPx = 0, autowrapMode = AutowrapMode.OFF): TextLayoutResult {
      return shapeText(text, {
        fontSizePx: FONT_SIZE,
        boxWidthPx,
        autowrapMode,
        lineSpacingPx: 0,
        fontSizePxAt: fontSizePxAtFromRuns(runs),
        fontMetrics: imageObjectFontMetrics(OPEN_SANS_FONT_METRICS),
      });
    }

    it('an image-only line places the quad at the line\'s own top-left, sized exactly to sizePx', () => {
      const runs = [imageRun(10, 10)];
      const layout = shapeWithImages(IMAGE_OBJECT_CHAR, runs);
      const placements = layoutRichTextRuns(runs, layout);
      expect(placements).toHaveLength(1);
      expect(placements[0]!.image).toEqual({ spec: runs[0]!.image!.spec, xPx: 0, yPx: 0, widthPx: 10, heightPx: 10 });
    });

    it("a small (10px) centered image on a line with 16px text does not grow the line — it fits entirely within the text's own ascent/descent", () => {
      const runs = [
        { text: 'hi', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE, alignment: 0 },
        imageRun(10, 10),
      ];
      const text = `hi${IMAGE_OBJECT_CHAR}`;
      const layout = shapeWithImages(text, runs);
      // ascentPx=18, descentPx=5 at 16px (getFontAscentPx(OPEN_SANS,16), fontMetrics.ts's own formula).
      expect(richTextLineMetrics(runs, layout)).toEqual([{ topPx: 0, ascentPx: 18, descentPx: 5, textAscentPx: 18, textDescentPx: 5 }]);
    });

    it('a large (40px) centered image on a 16px text line GROWS the line beyond the text\'s own ascent/descent', () => {
      const runs = [
        { text: 'hi', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE, alignment: 0 },
        imageRun(40, 40),
      ];
      const layout = shapeWithImages(`hi${IMAGE_OBJECT_CHAR}`, runs);
      const metrics = richTextLineMetrics(runs, layout);
      // yOffset = (-18+5)/2 - 20 = -26.5; ascent = max(18, 26.5) = 26.5; descent = max(5, -26.5+40) = 13.5.
      expect(metrics).toEqual([{ topPx: 0, ascentPx: 26.5, descentPx: 13.5, textAscentPx: 18, textDescentPx: 5 }]);
      const placements = layoutRichTextRuns(runs, layout);
      const imagePlacement = placements.find((p) => p.image)!;
      expect(imagePlacement.image!.yPx).toBe(26.5 - 26.5); // ascentPx + yOffset
    });

    it(
      'a 100px image forces its OWN line once it no longer fits beside its neighbours — at boxWidthPx 130 "Hi ' +
        IMAGE_OBJECT_CHAR +
        '" (Hi + the image) still shares one line with "Bye" wrapping to a second; at 110 the SAME image needs a line of its own, ' +
        'a THIRD line — the transition is driven entirely by the DECORATED width (an unresolved run would use the average-glyph fallback, ~9px, and never force it)',
      () => {
        const runs = [
          { text: 'Hi ', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE, alignment: 0 },
          imageRun(100, 10),
          { text: ' Bye', bold: false, italic: false, underline: false, color: WHITE, fontSizePx: FONT_SIZE, alignment: 0 },
        ];
        const text = `Hi ${IMAGE_OBJECT_CHAR} Bye`;
        const fitsBeside = shapeWithImages(text, runs, 130, AutowrapMode.WORD);
        expect(fitsBeside.lines.map((l) => l.text)).toEqual([`Hi ${IMAGE_OBJECT_CHAR}`, 'Bye']);

        const ownLine = shapeWithImages(text, runs, 110, AutowrapMode.WORD);
        expect(ownLine.lines.map((l) => l.text)).toEqual(['Hi', IMAGE_OBJECT_CHAR, 'Bye']);

        const placements = layoutRichTextRuns(runs, ownLine);
        expect(placements.map((p) => p.lineIndex)).toEqual([0, 1, 2]);
        expect(placements[1]!.image).toBeDefined();
      }
    );
  });
});

describe('richTextUnderlineMetrics', () => {
  const WHITE = { r: 1, g: 1, b: 1, a: 1 };

  it("is the MAX over EVERY run in the paragraph, not the underlined run's own size — a line's shaped substring inherits the paragraph's upos/uthk verbatim (text_server_adv.cpp:5310-5311), unlike ascent/descent, which ARE recomputed per line", () => {
    const runs = [
      { text: 'big', bold: true, italic: false, underline: false, color: WHITE, fontSizePx: 18, alignment: 0 },
      { text: 'small', bold: false, italic: false, underline: true, color: WHITE, fontSizePx: 16, alignment: 0 },
    ];
    // -(-100 - 50/2)*18/2048 and 50*18/2048: the 18px run's, though the 16px
    // run carries [u]. The -thickness/2 term is FreeType's top-edge-to-centre
    // conversion (sfobjs.c:1424-1425).
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
  // -(-100 - 50/2)*16/2048 and 50*16/2048: one paragraph's upos/uthk at 16px.
  const METRICS_16 = { positionPx: 0.9765625, thicknessPx: 0.390625 };
  // -(-100 - 50/2)*18/2048 and 50*18/2048: the same paragraph at 18px.
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
    // ceil(10.4-0.5)=10 .. ceil(23.2-0.5)-1=22: columns 10..22 inclusive.
    expect(rect!.x0).toBe(10);
    expect(rect!.x1).toBe(23);
  });

  it('returns null for an empty glyph list (nothing to underline)', () => {
    expect(underlineRectPx([], 18, METRICS_16)).toBeNull();
  });
});

/**
 * `fit_content`'s width is `get_content_width` (`rich_text_label.cpp`), a max of
 * `TS->shaped_text_get_size(lines_rid[i])` (`text_paragraph.cpp:601-608`), ceiled
 * (`text_server_adv.cpp:7524-7537`). In Godot, "Master volume" reports
 * `get_combined_minimum_size()` (116, 23), not its 115.84375 pen advance.
 */
describe('richTextLabelMinimumSize — the shaped extent is ceiled (text_server_adv.cpp:7524-7537)', () => {
  it("reports Godot's own whole-pixel 116 for a fit_content, non-wrapping 'Master volume'", () => {
    const result = 
      richTextLabelMinimumSize(
        node({ fitContent: true, text: 'Master volume', autowrapMode: 0 }),
        ctx()
      )
    ;
    expect(result.x).toBe(116);
  });

  it('leaves the 1px autowrap width floor alone — that branch never reads a shaped size', () => {
    const result = 
      richTextLabelMinimumSize(node({ fitContent: true, text: 'Master volume', autowrapMode: 2 }), ctx())
    ;
    expect(result.x).toBe(1);
  });
});

/**
 * `horizontal_alignment`, `vertical_alignment` and the `[center]`/`[right]`/
 * `[left]`/`[fill]` tags. RichTextLabel aligns in `_draw_line`, not
 * `TextParagraph::draw` (`scene/resources/text_paragraph.cpp:989-1023`), and
 * floors where Label truncates. Synthetic line widths keep this off font metrics.
 */

// In Godot, "Hello" in a 300x150 RichTextLabel inks x 1..38, 131..168 and 261..298
// for LEFT, CENTER and RIGHT: `floor((300-40)/2)` and `300-40`. TOP, CENTER and
// BOTTOM ink rows 6, 69 and 133: `vbegin` 63.5 and 127, and 63.5 + 6 = 69.5 draws
// on row 69, so these return floats and the line top floors once, downstream.
describe('RichTextLabel paragraph alignment', () => {
  describe('resolveParagraphAlignment (rich_text_label.cpp:3492-3505)', () => {
    it('falls back to the node property when no paragraph tag is open', () => {
      expect(resolveParagraphAlignment([], 2)).toBe(2);
      // `default_alignment` is HORIZONTAL_ALIGNMENT_LEFT (`:580`).
      expect(resolveParagraphAlignment([], undefined)).toBe(0);
    });

    it('takes the INNERMOST paragraph tag, overriding the property', () => {
      // `_find_alignment` walks OUTWARD from the item and returns the first
      // ITEM_PARAGRAPH it meets, so the last-opened tag wins.
      expect(resolveParagraphAlignment([{ name: 'center' }], 2)).toBe(1);
      expect(resolveParagraphAlignment([{ name: 'center' }, { name: 'right' }], 0)).toBe(2);
      expect(resolveParagraphAlignment([{ name: 'right' }, { name: 'left' }], 1)).toBe(0);
      expect(resolveParagraphAlignment([{ name: 'fill' }], 0)).toBe(3);
    });

    it('ignores a styling tag — only the four push_paragraph tags carry an alignment', () => {
      // `[b]`/`[u]`/`[color]` are `push_bold`/`push_underline`/`push_color`,
      // not `push_paragraph`, so none creates an ITEM_PARAGRAPH.
      expect(resolveParagraphAlignment([{ name: 'b' }, { name: 'u' }, { name: 'color' }], 2)).toBe(2);
    });
  });

  describe('richTextHorizontalOffsetPx (rich_text_label.cpp:1000-1014)', () => {
    it('leaves LEFT at the box origin', () => {
      expect(richTextHorizontalOffsetPx(70, 200, 0)).toBe(0);
    });

    it('floors half the slack for CENTER', () => {
      // `ofs.x += Math::floor((l_width - length) / 2.0)`: one floor, where
      // Label truncates twice.
      expect(richTextHorizontalOffsetPx(70, 200, 1)).toBe(65);
      expect(richTextHorizontalOffsetPx(70, 201, 1)).toBe(65);
      expect(richTextHorizontalOffsetPx(70.5, 201, 1)).toBe(65);
      expect(richTextHorizontalOffsetPx(70, 203, 1)).toBe(66);
    });

    it('takes the whole slack for RIGHT', () => {
      expect(richTextHorizontalOffsetPx(70, 200, 2)).toBe(130);
      expect(richTextHorizontalOffsetPx(70.5, 200, 2)).toBe(129);
    });

    it('leaves LEFT at the origin whatever the box width is', () => {
      expect(richTextHorizontalOffsetPx(70, 0, 0)).toBe(0);
    });

    it('CENTER keeps centring once the line OVERFLOWS its box (rich_text_label.cpp:1007-1010)', () => {
      // `_draw_line`'s arm is `off.x += Math::floor((width - length) / 2.0)`, with
      // no `length <= l_width` guard: that guard is `TextParagraph::draw`'s
      // (text_paragraph.cpp:1004), which RichTextLabel does not use.
      expect(richTextHorizontalOffsetPx(287, 200, 1)).toBe(-44);
      expect(richTextHorizontalOffsetPx(201, 200, 1)).toBe(-1);
    });

    it('hangs an OVERFLOWING line off the leading edge under CENTER and RIGHT alike', () => {
      // Neither arm of `_draw_line`'s switch guards on the line fitting.
      expect(richTextHorizontalOffsetPx(300, 200, 1)).toBe(-50);
      expect(richTextHorizontalOffsetPx(300, 200, 2)).toBe(-100);
    });

    it('still aligns a ZERO-width paragraph, which TextParagraph::draw would have skipped', () => {
      // `if (width > 0)` (text_paragraph.cpp:990) guards the other switch, so
      // CENTER and RIGHT pull the text off the leading edge. `RichTextLabel`
      // clips its contents (`:8225`), so a control this narrow shows none of it.
      expect(richTextHorizontalOffsetPx(70, 0, 1)).toBe(-35);
      expect(richTextHorizontalOffsetPx(70, 0, 2)).toBe(-70);
    });

    it('positions FILL like LEFT — justification is intra-line, not an origin shift', () => {
      // The LTR FILL arm of `:991`'s switch does nothing at all; only RTL
      // shifts. The intra-line stretch this slice does not do is a
      // `comparison.md` row.
      expect(richTextHorizontalOffsetPx(70, 200, 3)).toBe(0);
    });
  });

  describe('richTextVerticalOffsets (rich_text_label.cpp:1619-1652)', () => {
    it('leaves TOP untouched', () => {
      expect(richTextVerticalOffsets(100, 300, 0, 3)).toEqual({ vbeginPx: 0, vsepPx: 0 });
    });

    it('halves the slack for CENTER and takes all of it for BOTTOM, without truncating', () => {
      // `float vbegin = 0` (`:1628`), not Label's `int` pair, so a half pixel
      // survives here.
      expect(richTextVerticalOffsets(100, 300, 1, 3)).toEqual({ vbeginPx: 100, vsepPx: 0 });
      expect(richTextVerticalOffsets(101, 300, 1, 3)).toEqual({ vbeginPx: 99.5, vsepPx: 0 });
      expect(richTextVerticalOffsets(100, 300, 2, 3)).toEqual({ vbeginPx: 200, vsepPx: 0 });
    });

    it('spreads the slack between the gaps for FILL, and needs two lines to have a gap', () => {
      expect(richTextVerticalOffsets(100, 300, 3, 3)).toEqual({ vbeginPx: 0, vsepPx: 100 });
      expect(richTextVerticalOffsets(100, 300, 3, 1)).toEqual({ vbeginPx: 0, vsepPx: 0 });
    });

    it('stays TOP-aligned when the text is TALLER than its box, whatever the alignment', () => {
      // `:1630`'s `text_rect.size.y > total_height` guard. Label has none and
      // pulls its text upward here.
      for (const alignment of [1, 2, 3]) {
        expect(richTextVerticalOffsets(400, 300, alignment, 3)).toEqual({ vbeginPx: 0, vsepPx: 0 });
      }
    });
  });
});

describe('richTextTabStopsPx (rich_text_label.cpp:479-482)', () => {
  it('an explicit tab_stops array wins outright, ignoring tab_size', () => {
    expect(richTextTabStopsPx([10, 20], 8, OPEN_SANS_FONT_METRICS, 16)).toEqual([10, 20]);
  });

  it('falls back to ONE stop derived from tab_size * the space glyph advance when tab_stops is empty', () => {
    // Space glyph advance at size 16 (openSansMetrics.ts's own 532 design
    // units, unitsPerEm 2048): 532*16/2048 = 4.15625px; tab_size 4 -> 16.625.
    expect(richTextTabStopsPx(undefined, 4, OPEN_SANS_FONT_METRICS, 16)).toEqual([16.625]);
  });

  it('undefined tab_size falls back to the Godot default of 4', () => {
    expect(richTextTabStopsPx([], undefined, OPEN_SANS_FONT_METRICS, 16)).toEqual([16.625]);
  });

  it('tab_size <= 0 disables inline tab alignment entirely (no stops)', () => {
    expect(richTextTabStopsPx(undefined, 0, OPEN_SANS_FONT_METRICS, 16)).toEqual([]);
  });

  it('floors the derived stop at 1px even for a tiny font size', () => {
    expect(richTextTabStopsPx(undefined, 1, OPEN_SANS_FONT_METRICS, 1)).toEqual([1]);
  });
});
