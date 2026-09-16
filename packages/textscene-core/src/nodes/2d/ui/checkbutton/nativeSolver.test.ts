/**
 * `checkbutton/nativeSolver.ts` vs Godot 4.6.3 (`scene/gui/check_button.cpp`,
 * `scene/theme/default_theme.cpp:316-353`). Expected numbers are
 * hand-derived from the source, not recomputed the way the implementation
 * itself computes them — same vendored OpenSans_SemiBold metrics
 * `checkbox/nativeSolver.test.ts` cites (`unitsPerEm=2048`, `ascent=2189`,
 * `descent=600`; 'A' hmtx advance 1354, 'B' 1350 design units).
 *
 * At font size 16: ascentPx=ceil(2189*16/2048)=18, descentPx=ceil(600*16/2048)=5,
 * FONT_HEIGHT=23. 'AB' advance = (1354+1350)*(16/2048) = 21.125, shaped
 * (ceiled) width = 22.
 */
import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext, MinimumSizeResult } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { CheckButtonProperties } from './types';
import {
  checkButtonMinimumSize,
  checkButtonTextTheme,
  resolveCheckButtonDrawState,
  resolveCheckButtonIconKey,
  checkButtonIconColor,
  layoutCheckButtonContent,
  checkButtonMarginX,
  checkButtonMarginY,
  CHECKBUTTON_DEFAULT_FONT_COLOR,
  CHECKBUTTON_DEFAULT_PRESSED_FONT_COLOR,
  CHECKBUTTON_DEFAULT_DISABLED_FONT_COLOR,
} from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

const AB_WIDTH = (1354 + 1350) * (16 / 2048); // 21.125
const AB_SHAPED_WIDTH = Math.ceil(AB_WIDTH); // 22
const FONT_HEIGHT = 23;

function node(props: Partial<CheckButtonProperties>): SolveNode {
  return {
    ...solveNode(),
    path: 'CB',
    node: {
      name: 'CB',
      type: 'CheckButton',
      children: [],
      properties: { name: 'CB', ...props } as CheckButtonProperties,
    },
    // A local theme_override_colors/* reaches `resolveTextTheme` through
    // `n.colors` (the walker folds it in unconditionally), not props.
    colors: props.themeOverrideColors ?? {},
    constants: props.themeOverrideConstants ?? {},
  };
}

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

describe('resolveCheckButtonDrawState', () => {
  it('is "normal" when neither pressed nor disabled', () => {
    expect(resolveCheckButtonDrawState({} as CheckButtonProperties)).toBe('normal');
  });

  it('is "pressed" when button_pressed is true and not disabled', () => {
    expect(resolveCheckButtonDrawState({ buttonPressed: true } as CheckButtonProperties)).toBe('pressed');
  });

  it('is "disabled" when disabled is true, even if also pressed (disabled wins)', () => {
    expect(resolveCheckButtonDrawState({ buttonPressed: true, disabled: true } as CheckButtonProperties)).toBe(
      'disabled'
    );
  });
});

describe('checkButtonTextTheme', () => {
  it('resolves control_font_color for the normal state', () => {
    expect(checkButtonTextTheme(node({}), {} as CheckButtonProperties, 'normal', ctx()).color).toEqual(
      CHECKBUTTON_DEFAULT_FONT_COLOR
    );
  });

  it('resolves control_font_pressed_color (opaque white) for the pressed state', () => {
    expect(checkButtonTextTheme(node({}), {} as CheckButtonProperties, 'pressed', ctx()).color).toEqual(
      CHECKBUTTON_DEFAULT_PRESSED_FONT_COLOR
    );
  });

  it('resolves control_font_disabled_color (alpha 0.5) for the disabled state', () => {
    expect(checkButtonTextTheme(node({}), {} as CheckButtonProperties, 'disabled', ctx()).color).toEqual(
      CHECKBUTTON_DEFAULT_DISABLED_FONT_COLOR
    );
  });

  it('a theme_override_colors/font_color override wins over the default', () => {
    const props: CheckButtonProperties = {
      name: 'CB',
      themeOverrideColors: { font_color: { r: 1, g: 0, b: 0, a: 1 } },
    };
    expect(checkButtonTextTheme(node(props), props, 'normal', ctx()).color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });
});

describe('resolveCheckButtonIconKey (check_button.cpp:112-142)', () => {
  it('unchecked, not disabled -> unchecked', () => {
    expect(resolveCheckButtonIconKey({} as CheckButtonProperties)).toBe('unchecked');
  });

  it('checked, not disabled -> checked', () => {
    expect(resolveCheckButtonIconKey({ buttonPressed: true } as CheckButtonProperties)).toBe('checked');
  });

  it('unchecked, disabled -> uncheckedDisabled', () => {
    expect(resolveCheckButtonIconKey({ disabled: true } as CheckButtonProperties)).toBe('uncheckedDisabled');
  });

  it('checked, disabled -> checkedDisabled (disabled wins over checked for the icon variant)', () => {
    expect(resolveCheckButtonIconKey({ buttonPressed: true, disabled: true } as CheckButtonProperties)).toBe(
      'checkedDisabled'
    );
  });
});

describe('checkButtonIconColor (default_theme.cpp:352-353)', () => {
  it('is opaque white when unchecked', () => {
    expect(checkButtonIconColor({} as CheckButtonProperties, {})).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('is opaque white when checked (a DIFFERENT theme key, same default literal)', () => {
    expect(checkButtonIconColor({ buttonPressed: true } as CheckButtonProperties, {})).toEqual({
      r: 1,
      g: 1,
      b: 1,
      a: 1,
    });
  });

  it('a theme_override_colors/button_checked_color override (already folded into n.colors) wins when checked', () => {
    const props: CheckButtonProperties = { name: 'CB', buttonPressed: true };
    expect(
      checkButtonIconColor(props, { button_checked_color: { r: 0, g: 1, b: 0, a: 1 } })
    ).toEqual({ r: 0, g: 1, b: 0, a: 1 });
  });
});

describe('checkButtonMarginX / checkButtonMarginY (default_theme.cpp:317)', () => {
  it('marginY equals theme.contentMargin (round(4*scale))', () => {
    expect(checkButtonMarginY(ctx())).toBe(4);
  });

  it('marginX is round(6*scale)', () => {
    expect(checkButtonMarginX(ctx())).toBe(6);
  });

  it('marginX moves with a non-1 theme scale (default_theme.cpp:317: round(6*scale))', () => {
    expect(checkButtonMarginX({ theme: nativeTheme(1.5) })).toBe(9);
  });
});

describe('checkButtonMinimumSize (check_button.cpp:64-79) — no text', () => {
  it('is 2*marginX(6) + icon(32x16) width, 2*marginY(4) + icon height — (44, 24)', () => {
    expect(checkButtonMinimumSize(node({}), ctx())).toEqual({ x: 44, y: 24 });
  });
});

describe('checkButtonMinimumSize — with text', () => {
  it('adds text width + h_separation(4) alongside the icon width; height floors on the taller of text/icon', () => {
    const result = size(checkButtonMinimumSize(node({ text: 'AB' }), ctx()));
    // width = 12 (2*marginX) + 22 (shaped text) + 4 (h_separation) + 32 (icon) = 70.
    expect(result.x).toBe(12 + AB_SHAPED_WIDTH + 4 + 32);
    // height = 8 (2*marginY) + max(23, 16) = 31.
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('treats an absent measurer as "text contributes nothing" — icon-only floor still returns', () => {
    expect(checkButtonMinimumSize(node({ text: 'AB' }), ctx(false))).toEqual({ x: 44, y: 24 });
  });

  it('h_separation theme_override_constants wins over the theme default', () => {
    const result = size(
      checkButtonMinimumSize(node({ text: 'AB', themeOverrideConstants: { h_separation: 10 } }), ctx())
    );
    expect(result.x).toBe(12 + AB_SHAPED_WIDTH + 10 + 32);
  });

  it('icon_max_width theme_override_constants clamps the (32x16) icon before it contributes', () => {
    const result = size(
      checkButtonMinimumSize(node({ text: 'AB', themeOverrideConstants: { icon_max_width: 8 } }), ctx())
    );
    // fitIconSize(32x16, 8) = (8, 4).
    expect(result.x).toBe(12 + AB_SHAPED_WIDTH + 4 + 8);
    expect(result.y).toBe(8 + FONT_HEIGHT); // 4 < 23, text still floors height
  });
});

describe('layoutCheckButtonContent (check_button.cpp:126-133 + button.cpp:247-260,444-456)', () => {
  const BASE = {
    rectSize: { x: 150, y: 28 },
    marginX: 6,
    marginY: 4,
    iconSize: { x: 32, y: 16 },
    checkVOffset: 0,
    hSeparation: 4,
    hasText: true,
    textAlignment: 0,
    textNaturalSize: { x: 90, y: 26 },
  };

  it('icon sits flush against the RIGHT edge, vertically centred + check_v_offset', () => {
    const { iconRect } = layoutCheckButtonContent(BASE);
    // x = floor(150 - (32+6)) = 112. y = floor((28-16)/2 + 0) = 6.
    expect(iconRect).toEqual({ x: 112, y: 6, w: 32, h: 16 });
  });

  it('LEFT-aligned text (the default) starts at marginX with no shift', () => {
    const { textOffset } = layoutCheckButtonContent(BASE);
    expect(textOffset!.x).toBe(6);
    // customElementHeight = 28-8=20; y = floor((20-26)/2 + 4) = floor(1) = 1.
    expect(textOffset!.y).toBe(1);
  });

  it('CENTER-aligned text centres within the box left of the icon', () => {
    const { textOffset } = layoutCheckButtonContent({ ...BASE, textAlignment: 1 });
    // textBoxWidth = 150-6-36-6=102; shift=(102-90)/2=6; x=6+6=12.
    expect(textOffset!.x).toBe(12);
  });

  it('RIGHT-aligned text sits flush against the reserved icon gap', () => {
    const { textOffset } = layoutCheckButtonContent({ ...BASE, textAlignment: 2 });
    // shift = 102-90=12; x=6+12=18.
    expect(textOffset!.x).toBe(18);
  });

  it('returns textOffset: null when hasText is false (icon still positioned)', () => {
    const { iconRect, textOffset } = layoutCheckButtonContent({ ...BASE, hasText: false });
    expect(textOffset).toBeNull();
    expect(iconRect).toEqual({ x: 112, y: 6, w: 32, h: 16 });
  });

  it('check_v_offset shifts the icon vertically', () => {
    const { iconRect } = layoutCheckButtonContent({ ...BASE, checkVOffset: 3 });
    expect(iconRect.y).toBe(9);
  });
});
