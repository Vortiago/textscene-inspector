/**
 * `buttonMinimumSize` vs Godot 4.6.3
 * (`Button::get_minimum_size_for_text_and_icon`, `scene/gui/button.cpp:481-526`).
 * Expected numbers are hand-derived from the vendored OpenSans_SemiBold
 * metrics/atlas (same constants `label/nativeSolver.test.ts` cites:
 * `unitsPerEm=2048`, `ascent=2189`, `descent=600`; atlas `xadvance` for 'A' is
 * 28 at bake size 42) and the default theme's Button margin (`content_margin`
 * = `round(4*scale)` = 4 at scale 1, all four sides — `nativeTheme.ts`'s
 * `buttonMargin`) — an independent worked example, never the implementation's
 * own output.
 *
 * At font size 16 a Button floors on `font->get_height()` = ascent + descent =
 * 23 (`ascentPx=ceil(2189*16/2048)=18`, `descentPx=ceil(600*16/2048)=5`), NOT
 * on a line pitch. `line_spacing` is Label's own theme constant; Button sets
 * none, so nothing separates lines it never stacks. Measured against real
 * Godot 4.6.3: a `content_margin` 6 button is 12 + 23 = 35.
 * 'A' advance at 16px = 28*(16/42) = 10.666...; 'AB' = 21.333...
 */
import { describe, expect, it } from 'vitest';
import type { ControlProperties } from '../control/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import type { ButtonProperties } from './types';
import {
  buttonMinimumSize,
  buttonTextTheme,
  buttonIconColor,
  BUTTON_DEFAULT_DISABLED_FONT_COLOR,
  BUTTON_DEFAULT_FONT_COLOR,
} from './nativeSolver';

const A_ADVANCE = 28 * (16 / 42); // 10.666...
const AB_WIDTH = A_ADVANCE * 2; // 21.333...
const FONT_HEIGHT = 23;

function node(
  props: Partial<ButtonProperties>,
  styleBoxes: Record<string, StyleBoxFlatData> = {},
  textureSize: { x: number; y: number } | null = null
): SolveNode {
  return {
    path: 'B',
    node: { name: 'B', type: 'Button', children: [], properties: { name: 'B', ...props } as ControlProperties },
    children: [],
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
    expect(buttonMinimumSize(node({}), ctx())).toEqual({ x: 8, y: 8 });
  });

  it('adds the measured text size on top of the margin', () => {
    const result = buttonMinimumSize(node({ text: 'AB' }), ctx());
    expect(result.x).toBeCloseTo(8 + AB_WIDTH, 6);
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('treats an absent measurer as "text contributes nothing", NOT as the whole function failing — margin alone still returns', () => {
    const result = buttonMinimumSize(node({ text: 'AB' }), ctx(false));
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
    };
    expect(buttonMinimumSize(node({}, { normal: wide }), ctx())).toEqual({ x: 28, y: 12 });
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
    };
    expect(buttonMinimumSize(node({ disabled: true }, { disabled: narrow }), ctx())).toEqual({ x: 40, y: 4 });
  });
});

describe('buttonMinimumSize — icon contribution (!expand_icon && icon present)', () => {
  it('vertical_icon_alignment CENTER (default): height is the MAX of icon/text, width ADDS icon width + h_separation', () => {
    // icon 20x20 (shorter than the 23px font height): height stays 23.
    // width: 21.333 (text) + 20 (icon) + 4 (h_separation default) = 45.333.
    const result = buttonMinimumSize(node({ text: 'AB' }, {}, { x: 20, y: 20 }), ctx());
    expect(result.y).toBe(8 + FONT_HEIGHT);
    expect(result.x).toBeCloseTo(8 + AB_WIDTH + 20 + 4, 6);
  });

  it('vertical_icon_alignment CENTER: a TALLER icon floors the height instead of the text', () => {
    const result = buttonMinimumSize(
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
      const result = buttonMinimumSize(
        node({ text: 'AB', vertical_icon_alignment: undefined, ...{ verticalIconAlignment: 0 } }, {}, { x: 10, y: 15 }),
        ctx()
      );
      // 23 (initial text) + 15 (icon, += branch) + 23 (final font_height, += branch) = 61.
      expect(result.y).toBe(8 + 61);
    }
  );

  it('icon_alignment CENTER: width is the MAX of icon/text, no h_separation added', () => {
    const result = buttonMinimumSize(
      node({ text: 'AB', iconAlignment: 1 }, {}, { x: 30, y: 10 }),
      ctx()
    );
    expect(result.x).toBeCloseTo(8 + 30, 6); // 30 > 21.333, floors width; no +4 separation
  });

  it('expand_icon=true: the icon contributes NOTHING to minimum size (Godot gates the whole block on !expand_icon)', () => {
    const withIcon = buttonMinimumSize(node({ text: 'AB', expandIcon: true }, {}, { x: 100, y: 100 }), ctx());
    const withoutIcon = buttonMinimumSize(node({ text: 'AB' }), ctx());
    expect(withIcon).toEqual(withoutIcon);
  });

  it('an unresolved icon (textureSize still null) contributes nothing, exactly like TextureRect before its texture loads', () => {
    const result = buttonMinimumSize(node({ text: 'AB' }, {}, null), ctx());
    expect(result.x).toBeCloseTo(8 + AB_WIDTH, 6);
  });

  it('h_separation theme_override_constants wins over the theme default', () => {
    const result = buttonMinimumSize(
      node({ text: 'AB', themeOverrideConstants: { h_separation: 12 } }, {}, { x: 20, y: 20 }),
      ctx()
    );
    expect(result.x).toBeCloseTo(8 + AB_WIDTH + 20 + 12, 6);
  });

  it('icon_max_width theme_override_constants clamps the icon before it contributes', () => {
    const result = buttonMinimumSize(
      node({ text: 'AB', themeOverrideConstants: { icon_max_width: 10 } }, {}, { x: 20, y: 20 }),
      ctx()
    );
    // fitIconSize(20x20, 10) = 10x10 (aspect-preserving clamp).
    expect(result.x).toBeCloseTo(8 + AB_WIDTH + 10 + 4, 6);
    expect(result.y).toBe(8 + FONT_HEIGHT); // 10 < 23, height still floored by text
  });
});

describe('buttonTextTheme — font_color / font_disabled_color key mapping', () => {
  it('resolves the theme default control_font_color for the normal state', () => {
    expect(buttonTextTheme({} as ButtonProperties, 'normal', ctx())).toEqual({
      fontSizePx: 16,
      color: BUTTON_DEFAULT_FONT_COLOR,
    });
  });

  it('resolves control_font_disabled_color (control_font_color * Color(1,1,1,0.5)) for the disabled state', () => {
    expect(buttonTextTheme({} as ButtonProperties, 'disabled', ctx())).toEqual({
      fontSizePx: 16,
      color: BUTTON_DEFAULT_DISABLED_FONT_COLOR,
    });
    expect(BUTTON_DEFAULT_DISABLED_FONT_COLOR).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 0.5 });
  });

  it('a theme_override_colors/font_disabled_color override wins over the default disabled color', () => {
    const props = { themeOverrideColors: { font_disabled_color: { r: 1, g: 0, b: 0, a: 1 } } } as ButtonProperties;
    expect(buttonTextTheme(props, 'disabled', ctx()).color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('theme_override_font_sizes/font_size overrides the theme default for BOTH states', () => {
    const props = { themeOverrideFontSizes: { font_size: 24 } } as ButtonProperties;
    expect(buttonTextTheme(props, 'normal', ctx()).fontSizePx).toBe(24);
    expect(buttonTextTheme(props, 'disabled', ctx()).fontSizePx).toBe(24);
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
    const props = { themeOverrideColors: { icon_disabled_color: { r: 1, g: 0, b: 0, a: 1 } } } as ButtonProperties;
    expect(buttonIconColor(props, 'disabled')).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });
});
