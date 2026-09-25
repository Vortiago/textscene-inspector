/**
 * `buttonMinimumSize` against Godot 4.6.3 (`scene/gui/button.cpp:481-526`), hand-derived from
 * OpenSans SemiBold (unitsPerEm 2048, ascent 2189, descent 600, `openSansMetrics.ts` advances)
 * and the default margin of 4 a side. At 16px a Button floors on the font height 18 + 5 = 23,
 * not a line pitch, since it sets no `line_spacing`. Measured: a `content_margin` 6 button is 35.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { TextLayoutResult } from '../../../../r3f/controls/native/text/textLayout';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { FontResource } from '../../../../resources/fonts/font/types';
import * as logger from '../../../../logger';
import type { ButtonProperties } from './types';
import {
  buttonMinimumSize,
  buttonTextTheme,
  buttonIconColor,
  BUTTON_DEFAULT_DISABLED_FONT_COLOR,
  BUTTON_DEFAULT_FONT_COLOR,
  BUTTON_THEME_FONT_KEY,
  buttonLabelShape,
} from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

const minSize = buttonMinimumSize;

// 'A' advances 1354 design units and 'B' 1350, so at 16px 'A' is 10.578125 and 'AB' 21.125.
const AB_WIDTH = (1354 + 1350) * (16 / 2048); // 21.125
// The shaped size of 'AB': `TS->shaped_text_get_size(...).x` ceils the pen
// advance to a whole pixel (`text_server_adv.cpp:7524-7537`), and every
// minimum size below is built from that, not from the fractional sum.
const AB_SHAPED_WIDTH = Math.ceil(AB_WIDTH); // 22
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
    // A local theme_override_colors/* reaches `resolveTextTheme` through
    // `n.colors`, which the walker folds in, not through props.
    colors: props.themeOverrideColors ?? {},
    constants: props.themeOverrideConstants ?? {},
  };
}

function styleBoxWithMargin(contentMargin: StyleBoxFlatData['contentMargin']): StyleBoxFlatData {
  return {
    bgColor: { r: 0, g: 0, b: 0, a: 1 },
    borderColor: { r: 0, g: 0, b: 0, a: 1 },
    borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
    cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
    expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
    contentMargin,
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
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
    expect(result.x).toBeCloseTo(8 + AB_SHAPED_WIDTH, 6);
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('treats an absent measurer as "text contributes nothing", NOT as the whole function failing — margin alone still returns', () => {
    const result = minSize(node({ text: 'AB' }), ctx(false));
    expect(result).toEqual({ x: 8, y: 8 });
  });

  it('clip_text zeroes the text width contribution, leaving only the margin (button.cpp:492-494)', () => {
    const result = minSize(node({ text: 'AB', clipText: true }), ctx());
    expect(result.x).toBe(8);
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('a trimming text_overrun_behavior also zeroes the text width contribution', () => {
    const result = minSize(node({ text: 'AB', overrunBehavior: 3 }), ctx());
    expect(result.x).toBe(8);
  });

  it('OVERRUN_NO_TRIMMING (0) and no clip_text leaves the width unaffected', () => {
    const result = minSize(node({ text: 'AB', overrunBehavior: 0 }), ctx());
    expect(result.x).toBeCloseTo(8 + AB_SHAPED_WIDTH, 6);
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
      cornerDetail: 8,
      skew: { x: 0, y: 0 },
      shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
      shadowSize: 0,
      shadowOffset: { x: 0, y: 0 },
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
      cornerDetail: 8,
      skew: { x: 0, y: 0 },
      shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
      shadowSize: 0,
      shadowOffset: { x: 0, y: 0 },
    };
    expect(minSize(node({ disabled: true }, { disabled: narrow }), ctx())).toEqual({ x: 40, y: 4 });
  });

  // `button.cpp:525` sizes off `_get_current_stylebox()`, whose every arm
  // (`:100-148`) prefers `<state>_mirrored` under `is_layout_rtl()`.
  it('sizes off the normal_mirrored margin under RTL, and off normal under LTR', () => {
    const mirrored = styleBoxWithMargin({ left: 9, top: 5, right: 5, bottom: 5 });
    const plain = styleBoxWithMargin({ left: 1, top: 3, right: 9, bottom: 3 });
    const boxes = { normal: plain, normal_mirrored: mirrored };
    expect(minSize({ ...node({}, boxes), rtl: true }, ctx())).toEqual({ x: 14, y: 10 });
    expect(minSize({ ...node({}, boxes), rtl: false }, ctx())).toEqual({ x: 10, y: 6 });
  });
});

describe('buttonMinimumSize — icon contribution (!expand_icon && icon present)', () => {
  it('vertical_icon_alignment CENTER (default): height is the MAX of icon/text, width ADDS icon width + h_separation', () => {
    // icon 20x20 (shorter than the 23px font height): height stays 23.
    // width: 21.125 (text) + 20 (icon) + 4 (h_separation default) = 45.125.
    const result = minSize(node({ text: 'AB' }, {}, { x: 20, y: 20 }), ctx());
    expect(result.y).toBe(8 + FONT_HEIGHT);
    expect(result.x).toBeCloseTo(8 + AB_SHAPED_WIDTH + 20 + 4, 6);
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
    expect(result.x).toBeCloseTo(8 + AB_SHAPED_WIDTH, 6);
  });

  it('h_separation theme_override_constants wins over the theme default', () => {
    const result = minSize(
      node({ text: 'AB', themeOverrideConstants: { h_separation: 12 } }, {}, { x: 20, y: 20 }),
      ctx()
    );
    expect(result.x).toBeCloseTo(8 + AB_SHAPED_WIDTH + 20 + 12, 6);
  });

  it('icon_max_width theme_override_constants clamps the icon before it contributes', () => {
    const result = minSize(
      node({ text: 'AB', themeOverrideConstants: { icon_max_width: 10 } }, {}, { x: 20, y: 20 }),
      ctx()
    );
    // fitIconSize(20x20, 10) = 10x10 (aspect-preserving clamp).
    expect(result.x).toBeCloseTo(8 + AB_SHAPED_WIDTH + 10 + 4, 6);
    expect(result.y).toBe(8 + FONT_HEIGHT); // 10 < 23, height still floored by text
  });
});

describe('buttonLabelShape — the one shaping the solver and the painter share', () => {
  const shape = (props: Partial<ButtonProperties>): TextLayoutResult | null =>
    buttonLabelShape(node(props), ctx().theme);

  it('shapes the label', () => {
    const layout = shape({ text: 'AB' })!;
    expect(layout.widthPx).toBeCloseTo(AB_WIDTH, 6);
    expect(layout.lines).toHaveLength(1);
    expect(layout.lines[0]?.text).toBe('AB');
  });

  it('is null for empty text — the one case neither side draws', () => {
    expect(shape({})).toBeNull();
  });

  it('shapes at boxWidthPx 0 / autowrap OFF / lineSpacingPx 0 — Button never wraps', () => {
    // Single line ('AB' has no hard break), so widthPx/heightPx alone prove
    // this: an autowrap-constrained shape of 'AB' at a 0-width box would
    // have broken onto multiple lines instead.
    const layout = shape({ text: 'AB' })!;
    expect(layout.lines).toHaveLength(1);
    expect(layout.heightPx).toBe(FONT_HEIGHT);
  });

  it('ignores the readiness gate — that lives in the solver, and the painter shapes unconditionally', () => {
    expect(minSize(node({ text: 'AB' }), ctx(false))).toEqual(minSize(node({}), ctx(false)));
    expect(buttonLabelShape(node({ text: 'AB' }), ctx(false).theme)).not.toBeNull();
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
    expect(buttonIconColor({}, 'normal')).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('is white at 0.4 alpha for the disabled state (icon_disabled_color = Color(1,1,1,0.4))', () => {
    expect(buttonIconColor({}, 'disabled')).toEqual({ r: 1, g: 1, b: 1, a: 0.4 });
  });

  it('a theme_override_colors/icon_disabled_color override (already folded into n.colors) wins over the default', () => {
    expect(buttonIconColor({ icon_disabled_color: { r: 1, g: 0, b: 0, a: 1 } }, 'disabled')).toEqual({
      r: 1,
      g: 0,
      b: 0,
      a: 1,
    });
  });
});

describe(`buttonMinimumSize — resolves this Button's own theme font key ("${BUTTON_THEME_FONT_KEY}", default_theme.cpp:152)`, () => {
  // Without a DOM, `peekSceneFontMetrics` always answers the bundled default, so a
  // resolved value cannot be observed. It warns for an unresolvable font (a SystemFont),
  // which proves the lookup found something.
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

/**
 * The minimum width is the ceiled text extent plus the margins: `paragraph->get_size()` (`button.cpp:492`)
 * is a max over `shaped_text_get_size` (`text_paragraph.cpp:601-608`), which ceils (`text_server_adv.cpp:7524-7537`).
 * Expected widths are `get_combined_minimum_size()` (height 31) in Godot 4.6.3 on
 * `scenes/fixtures/complex-2d-gui.tscn` at 1152x648, whose buttons add only the default margin 4 a side.
 */
describe('buttonMinimumSize — the shaped text extent is ceiled (text_server_adv.cpp:7524-7537)', () => {
  it.each([
    ['Apply', 52],
    ['Restore defaults', 135],
    ['Back to bridge', 119],
  ])('%p reaches Godot\'s own whole-pixel minimum width %p', (text, expected) => {
    expect(minSize(node({ text }), ctx()).x).toBe(expected);
  });

  it('adds the margin to the CEILED text width, not the ceil of the margined width — both are whole here, and the text is what carries the fraction', () => {
    const withText = minSize(node({ text: 'Apply' }), ctx()).x;
    const empty = minSize(node({}), ctx()).x;
    expect(empty).toBe(8);
    expect(withText - empty).toBe(44);
  });
});

/**
 * `Button::_shape` ORs `autowrap_flags_trim` onto Label's break flags (`button.cpp:546-561`), and the
 * draw path shapes at `Math::ceil(MAX(1.0f, drawable_size_remained.width))` (`:428-432`). The minimum
 * size drops the text's width (`:493`), the `is_clipped` trigger (`button.cpp:332`) that `clip_text`
 * and a trimming overrun share, since a narrower box wraps instead of overflowing.
 */
describe('Button.autowrap_mode (button.cpp:493,546-561)', () => {
  const LONG = 'alpha bravo charlie delta';

  function minSize(props: Partial<ButtonProperties>, tentativeWidthPx?: number) {
    const context: SolveContext = {
      ...ctx(),
      ...(tentativeWidthPx === undefined
        ? {}
        : { tentativeRect: () => ({ x: 0, y: 0, w: tentativeWidthPx, h: 40 }) }),
    };
    return buttonMinimumSize(node(props), context);
  }

  it('keeps the text width with autowrap off', () => {
    expect(minSize({ text: LONG }).x).toBeGreaterThan(100);
  });

  it('drops the text width contribution once autowrap is on (button.cpp:493)', () => {
    // Only the stylebox margins remain.
    const wrapped = minSize({ text: LONG, autowrapMode: 2 });
    const empty = minSize({ text: '' });
    expect(wrapped.x).toBe(empty.x);
  });

  it('reports a TALLER minimum once a tentative rect narrows it to several rows', () => {
    const oneRow = minSize({ text: LONG, autowrapMode: 2 });
    const wrapped = minSize({ text: LONG, autowrapMode: 2 }, 80);
    expect(wrapped.y).toBeGreaterThan(oneRow.y);
  });

  it('never wraps at AUTOWRAP_OFF, whatever the tentative rect says', () => {
    expect(minSize({ text: LONG }, 80).y).toBe(minSize({ text: LONG }).y);
  });
});

describe('buttonLabelShape — the wrap width and trim flags reach the shaper (button.cpp:428-432,546-561)', () => {
  function rows(props: Partial<ButtonProperties>, boxWidthPx: number): string[] {
    return (buttonLabelShape(node(props), nativeTheme(1), boxWidthPx)?.lines ?? []).map((l) => l.text);
  }

  it('keeps one row at AUTOWRAP_OFF however narrow the box', () => {
    expect(rows({ text: 'alpha bravo' }, 20)).toEqual(['alpha bravo']);
  });

  it('breaks on a word boundary at AUTOWRAP_WORD', () => {
    expect(rows({ text: 'alpha bravo', autowrapMode: 2 }, 50)).toEqual(['alpha', 'bravo']);
  });

  it('breaks mid-word at AUTOWRAP_ARBITRARY', () => {
    expect(rows({ text: 'alphabravo', autowrapMode: 1 }, 50).length).toBeGreaterThan(1);
  });

  it('keeps the trailing edge space when autowrap_trim_flags clears it (label.h:45)', () => {
    // BREAK_TRIM_START_EDGE_SPACES | BREAK_TRIM_END_EDGE_SPACES is 64 | 128.
    // Authoring 0 keeps both edges.
    expect(rows({ text: 'alpha bravo', autowrapMode: 2, autowrapTrimFlags: 0 }, 50)).toEqual(['alpha ', 'bravo']);
  });
});
