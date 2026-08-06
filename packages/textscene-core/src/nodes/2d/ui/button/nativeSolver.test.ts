/**
 * `buttonMinimumSize` vs Godot 4.6.3
 * (`Button::get_minimum_size_for_text_and_icon`, `scene/gui/button.cpp:481-526`).
 * Expected numbers are hand-derived from the vendored OpenSans_SemiBold
 * metrics/atlas (same constants `label/nativeSolver.test.ts` cites:
 * `unitsPerEm=2048`, `ascent=2189`, `descent=600`; `hmtx` advance width for
 * 'A' is 1354 design units — `openSansMetrics.ts`'s CONTINUOUS
 * `advanceWidths`, not `openSansAtlas.ts`'s own atlas-bake-resolution-42
 * `xadvance`) and the default theme's Button margin (`content_margin` =
 * `round(4*scale)` = 4 at scale 1, all four sides — `nativeTheme.ts`'s
 * `buttonMargin`) — an independent worked example, never the implementation's
 * own output.
 *
 * At font size 16 a Button floors on `font->get_height()` = ascent + descent =
 * 23 (`ascentPx=ceil(2189*16/2048)=18`, `descentPx=ceil(600*16/2048)=5`), NOT
 * on a line pitch. `line_spacing` is Label's own theme constant; Button sets
 * none, so nothing separates lines it never stacks. Measured against real
 * Godot 4.6.3: a `content_margin` 6 button is 12 + 23 = 35.
 * 'A' advance at 16px = 1354*(16/2048) = 10.578125; 'AB' = (1354+1350)*(16/2048) = 21.125.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { FontResource } from '../../../../resources/processing/fontProcessing';
import * as logger from '../../../../logger';
import type { ButtonProperties } from './types';
import {
  buttonMinimumSize,
  buttonTextTheme,
  buttonIconColor,
  BUTTON_DEFAULT_DISABLED_FONT_COLOR,
  BUTTON_DEFAULT_FONT_COLOR,
  BUTTON_THEME_FONT_KEY,
} from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

/** `buttonMinimumSize`'s `size` half only — every test below except the dedicated `meta` describe cares only about this, exactly like before `{ size, meta }` existed. */
function minSize(...args: Parameters<typeof buttonMinimumSize>): Vec2 {
  const result = buttonMinimumSize(...args);
  return 'size' in result ? result.size : result;
}

/** `buttonMinimumSize`'s `meta` half — the shaped `TextLayoutResult`, or `undefined` for empty text / no measurer. */
function minMeta(...args: Parameters<typeof buttonMinimumSize>): unknown {
  const result = buttonMinimumSize(...args);
  return 'meta' in result ? result.meta : undefined;
}

// 'A's hmtx advance width is 1354 design units, 'B's is 1350 — a DIFFERENT
// glyph, so 'AB's width is their SUM (the two only coincided at the OLD
// atlas-bake-resolution-42 xadvance, where both rounded to the integer 28 —
// a coincidence of that rounding, not a fact about the font).
const AB_WIDTH = (1354 + 1350) * (16 / 2048); // 21.125
const FONT_HEIGHT = 23;

function node(
  props: Partial<ButtonProperties>,
  styleBoxes: Record<string, StyleBoxFlatData> = {},
  textureSize: { x: number; y: number } | null = null
): SolveNode {
  return {
    ...solveNode(),
    path: 'B',
    node: { name: 'B', type: 'Button', children: [], properties: { name: 'B', ...props } as ButtonProperties },
    styleBoxes,
    textureSize,
  };
}

function ctx(withMeasurer = true): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: withMeasurer ? measureText : null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

describe('buttonMinimumSize — StyleBox content margins + text, no icon', () => {
  it('is exactly the default-theme button margin for empty text (8, 8) — content_margin=4 all sides', () => {
    expect(minSize(node({}), ctx())).toEqual({ x: 8, y: 8 });
  });

  it('adds the measured text size on top of the margin', () => {
    const result = minSize(node({ text: 'AB' }), ctx());
    expect(result.x).toBeCloseTo(8 + AB_WIDTH, 6);
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('treats an absent measurer as "text contributes nothing", NOT as the whole function failing — margin alone still returns', () => {
    const result = minSize(node({ text: 'AB' }), ctx(false));
    expect(result).toEqual({ x: 8, y: 8 });
  });

  it('reads a resolved theme_override_styles/normal content margin instead of the default theme', () => {
    const wide: StyleBoxFlatData = {
      bgColor: { r: 0, g: 0, b: 0, a: 1 },
      borderColor: { r: 0, g: 0, b: 0, a: 1 },
      borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
      cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
      expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
      contentMargin: { left: 14, top: 6, right: 14, bottom: 6 },
      drawCenter: true,
      borderBlend: false,
      antiAliased: true,
      aaSize: 1,
    };
    expect(minSize(node({}, { normal: wide }), ctx())).toEqual({ x: 28, y: 12 });
  });

  it('uses the DISABLED override/theme margin, not normal, once disabled=true', () => {
    const narrow: StyleBoxFlatData = {
      bgColor: { r: 0, g: 0, b: 0, a: 1 },
      borderColor: { r: 0, g: 0, b: 0, a: 1 },
      borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
      cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
      expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
      contentMargin: { left: 20, top: 2, right: 20, bottom: 2 },
      drawCenter: true,
      borderBlend: false,
      antiAliased: true,
      aaSize: 1,
    };
    expect(minSize(node({ disabled: true }, { disabled: narrow }), ctx())).toEqual({ x: 40, y: 4 });
  });
});

describe('buttonMinimumSize — icon contribution (!expand_icon && icon present)', () => {
  it('vertical_icon_alignment CENTER (default): height is the MAX of icon/text, width ADDS icon width + h_separation', () => {
    // icon 20x20 (shorter than the 23px font height): height stays 23.
    // width: 21.125 (text) + 20 (icon) + 4 (h_separation default) = 45.125.
    const result = minSize(node({ text: 'AB' }, {}, { x: 20, y: 20 }), ctx());
    expect(result.y).toBe(8 + FONT_HEIGHT);
    expect(result.x).toBeCloseTo(8 + AB_WIDTH + 20 + 4, 6);
  });

  it('vertical_icon_alignment CENTER: a TALLER icon floors the height instead of the text', () => {
    const result = minSize(
      node({ text: 'AB' }, {}, { x: 10, y: 40 }),
      ctx()
    );
    expect(result.y).toBe(8 + 40);
  });

  it(
    'vertical_icon_alignment TOP/BOTTOM: height ACCUMULATES (icon height + text height COUNTED TWICE — ' +
      'once as the initial paragraph size, once again as the final font_height add) — ported verbatim from ' +
      'button.cpp:322-329,515-522, not a divergence this port introduces',
    () => {
      const result = minSize(
        node({ text: 'AB', verticalIconAlignment: 0 }, {}, { x: 10, y: 15 }),
        ctx()
      );
      // 23 (initial text) + 15 (icon, += branch) + 23 (final font_height, += branch) = 61.
      expect(result.y).toBe(8 + 61);
    }
  );

  it('icon_alignment CENTER: width is the MAX of icon/text, no h_separation added', () => {
    const result = minSize(
      node({ text: 'AB', iconAlignment: 1 }, {}, { x: 30, y: 10 }),
      ctx()
    );
    expect(result.x).toBeCloseTo(8 + 30, 6); // 30 > 21.125, floors width; no +4 separation
  });

  it('expand_icon=true: the icon contributes NOTHING to minimum size (Godot gates the whole block on !expand_icon)', () => {
    const withIcon = minSize(node({ text: 'AB', expandIcon: true }, {}, { x: 100, y: 100 }), ctx());
    const withoutIcon = minSize(node({ text: 'AB' }), ctx());
    expect(withIcon).toEqual(withoutIcon);
  });

  it('an unresolved icon (textureSize still null) contributes nothing, exactly like TextureRect before its texture loads', () => {
    const result = minSize(node({ text: 'AB' }, {}, null), ctx());
    expect(result.x).toBeCloseTo(8 + AB_WIDTH, 6);
  });

  it('h_separation theme_override_constants wins over the theme default', () => {
    const result = minSize(
      node({ text: 'AB', themeOverrideConstants: { h_separation: 12 } }, {}, { x: 20, y: 20 }),
      ctx()
    );
    expect(result.x).toBeCloseTo(8 + AB_WIDTH + 20 + 12, 6);
  });

  it('icon_max_width theme_override_constants clamps the icon before it contributes', () => {
    const result = minSize(
      node({ text: 'AB', themeOverrideConstants: { icon_max_width: 10 } }, {}, { x: 20, y: 20 }),
      ctx()
    );
    // fitIconSize(20x20, 10) = 10x10 (aspect-preserving clamp).
    expect(result.x).toBeCloseTo(8 + AB_WIDTH + 10 + 4, 6);
    expect(result.y).toBe(8 + FONT_HEIGHT); // 10 < 23, height still floored by text
  });
});

describe('buttonMinimumSize — meta carries the shaped TextLayoutResult (ITEM C: no re-shape in the painter)', () => {
  it('attaches the shaped layout as meta when there is text and a measurer', () => {
    const meta = minMeta(node({ text: 'AB' }), ctx()) as TextLayoutResult;
    expect(meta.widthPx).toBeCloseTo(AB_WIDTH, 6);
    expect(meta.lines).toHaveLength(1);
    expect(meta.lines[0]?.text).toBe('AB');
  });

  it('is undefined for empty text', () => {
    expect(minMeta(node({}), ctx())).toBeUndefined();
  });

  it('is undefined when no measurer is available, matching the size half\'s own "no measurer" gate', () => {
    expect(minMeta(node({ text: 'AB' }), ctx(false))).toBeUndefined();
  });

  it('is shaped at boxWidthPx 0 / autowrap OFF / lineSpacingPx 0 — the SAME literal parameters Button\'s own painter shapes with', () => {
    const meta = minMeta(node({ text: 'AB' }), ctx()) as TextLayoutResult;
    // Single line ('AB' has no hard break), so widthPx/heightPx alone prove
    // this: an autowrap-constrained shape of 'AB' at a 0-width box would
    // have broken onto multiple lines instead.
    expect(meta.lines).toHaveLength(1);
    expect(meta.heightPx).toBe(FONT_HEIGHT);
  });
});

describe('buttonTextTheme — font_color / font_disabled_color key mapping', () => {
  it('resolves the theme default control_font_color for the normal state', () => {
    expect(buttonTextTheme(node({}), {} as ButtonProperties, 'normal', ctx())).toEqual({
      fontSizePx: 16,
      color: BUTTON_DEFAULT_FONT_COLOR,
    });
  });

  it('resolves control_font_disabled_color (control_font_color * Color(1,1,1,0.5)) for the disabled state', () => {
    expect(buttonTextTheme(node({}), {} as ButtonProperties, 'disabled', ctx())).toEqual({
      fontSizePx: 16,
      color: BUTTON_DEFAULT_DISABLED_FONT_COLOR,
    });
    expect(BUTTON_DEFAULT_DISABLED_FONT_COLOR).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 0.5 });
  });

  it('a theme_override_colors/font_disabled_color override wins over the default disabled color', () => {
    const props: ButtonProperties = {
      name: 'B',
      themeOverrideColors: { font_disabled_color: { r: 1, g: 0, b: 0, a: 1 } },
    };
    expect(buttonTextTheme(node(props), props, 'disabled', ctx()).color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('theme_override_font_sizes/font_size overrides the theme default for BOTH states', () => {
    const props: ButtonProperties = { name: 'B', themeOverrideFontSizes: { font_size: 24 } };
    expect(buttonTextTheme(node(props), props, 'normal', ctx()).fontSizePx).toBe(24);
    expect(buttonTextTheme(node(props), props, 'disabled', ctx()).fontSizePx).toBe(24);
  });
});

describe('buttonIconColor — icon_normal_color / icon_disabled_color (default_theme.cpp:164,169)', () => {
  it('is opaque white for the normal state (icon_normal_color = Color(1,1,1,1))', () => {
    expect(buttonIconColor({} as ButtonProperties, 'normal')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('is white at 0.4 alpha for the disabled state (icon_disabled_color = Color(1,1,1,0.4))', () => {
    expect(buttonIconColor({} as ButtonProperties, 'disabled')).toEqual({ r: 1, g: 1, b: 1, a: 0.4 });
  });

  it('a theme_override_colors/icon_disabled_color override wins over the default', () => {
    const props: ButtonProperties = {
      name: 'B',
      themeOverrideColors: { icon_disabled_color: { r: 1, g: 0, b: 0, a: 1 } },
    };
    expect(buttonIconColor(props, 'disabled')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });
});

describe(`buttonMinimumSize — resolves this Button's own theme font key ("${BUTTON_THEME_FONT_KEY}", default_theme.cpp:152)`, () => {
  // `peekSceneFontMetrics` (`sceneFontLoader.ts`) always answers the bundled
  // default under this DOM-less test environment, so a resolved `FontMetrics`
  // VALUE cannot be observed — but it warns unconditionally for an
  // UNRESOLVABLE font (a SystemFont), which proves the lookup found
  // something at all (`resolveNodeFontMetrics.test.ts`'s own doc has the
  // full reasoning).
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("a theme_override_fonts/font local override is fed to the text engine (proven by peekSceneFontMetrics's own warn)", () => {
    const systemFont: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const n: SolveNode = { ...node({ text: 'A' }), fontOverrides: { [BUTTON_THEME_FONT_KEY]: systemFont } };
    buttonMinimumSize(n, ctx());
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('a local override under a different key is not consulted', () => {
    const systemFont: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const n: SolveNode = { ...node({ text: 'A' }), fontOverrides: { normal_font: systemFont } };
    buttonMinimumSize(n, ctx());
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
