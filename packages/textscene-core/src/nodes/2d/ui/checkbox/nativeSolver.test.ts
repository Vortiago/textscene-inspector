/**
 * `checkbox/nativeSolver.ts` against Godot 4.6.3 (`scene/gui/check_box.cpp`,
 * `scene/theme/default_theme.cpp:274-313`), hand-derived from OpenSans SemiBold (unitsPerEm 2048,
 * ascent 2189, descent 600). At 16px a CheckBox floors on the font height 18 + 5 = 23: it sets no
 * `line_spacing`. `textOffset` is the paragraph's box top-left, and `<TextRun>` owns the line anchor.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { FontResource } from '../../../../resources/fonts/font/types';
import * as logger from '../../../../logger';
import type { CheckBoxProperties } from './types';
import {
  checkBoxIconNaturalSize,
  checkBoxMinimumSize,
  checkBoxTextTheme,
  resolveCheckBoxDrawState,
  resolveCheckBoxIconKey,
  layoutCheckBoxContent,
  CHECKBOX_DEFAULT_FONT_COLOR,
  CHECKBOX_DEFAULT_PRESSED_FONT_COLOR,
  CHECKBOX_DEFAULT_DISABLED_FONT_COLOR,
  CHECKBOX_ICON_NATURAL_SIZE,
  CHECKBOX_THEME_FONT_KEY,
} from './nativeSolver';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

// 'A' advances 1354 design units and 'B' 1350, so at 16px 'A' is 10.578125 and 'AB' 21.125.
const AB_WIDTH = (1354 + 1350) * (16 / 2048); // 21.125
// The shaped size of 'AB': `TS->shaped_text_get_size(...).x` ceils the pen
// advance to a whole pixel (`text_server_adv.cpp:7524-7537`), and every
// minimum size below is built from that, not from the fractional sum.
const AB_SHAPED_WIDTH = Math.ceil(AB_WIDTH); // 22
const FONT_HEIGHT = 23;

function node(props: Partial<CheckBoxProperties>): SolveNode {
  return {
    ...solveNode(),
    path: 'C',
    node: { name: 'C', type: 'CheckBox', children: [], properties: { name: 'C', ...props } as CheckBoxProperties },
    // A local theme_override_colors/* reaches `resolveTextTheme` through
    // `n.colors` (the walker folds it in unconditionally), not props.
    colors: props.themeOverrideColors ?? {},
    constants: props.themeOverrideConstants ?? {},
  };
}

function ctx(withMeasurer = true): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: withMeasurer ? measureText : null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

/**
 * `BaseButton::get_draw_mode` (`base_button.cpp:325-358`) with no hover or press attempt. Measured
 * with `pnpm ref:godot scenes/fixtures/unit-checkbox.tscn --mode 2d`: the checked label reads
 * (255,255,255) at (527,298), and the disabled one rgb(150,150,150) at (526,350), which is
 * `font_disabled_color` over the 76,76,76 clear colour: `0.5*223 + 0.5*76 = 149.5`.
 */
describe('resolveCheckBoxDrawState', () => {
  it('is "normal" when neither pressed nor disabled', () => {
    expect(resolveCheckBoxDrawState({} as CheckBoxProperties)).toBe('normal');
  });

  it('is "pressed" when button_pressed is true (checked) and not disabled', () => {
    expect(resolveCheckBoxDrawState({ buttonPressed: true } as CheckBoxProperties)).toBe('pressed');
  });

  it('is "disabled" when disabled is true, even if also pressed (disabled wins)', () => {
    expect(resolveCheckBoxDrawState({ buttonPressed: true, disabled: true } as CheckBoxProperties)).toBe('disabled');
  });
});

describe('checkBoxTextTheme', () => {
  it('resolves control_font_color (0.875 opaque) for the normal state', () => {
    expect(checkBoxTextTheme(node({}), {} as CheckBoxProperties, 'normal', ctx())).toEqual({
      fontSizePx: 16,
      color: CHECKBOX_DEFAULT_FONT_COLOR,
    });
  });

  it('resolves control_font_pressed_color (opaque white) for the pressed (checked) state', () => {
    expect(checkBoxTextTheme(node({}), {} as CheckBoxProperties, 'pressed', ctx()).color).toEqual(
      CHECKBOX_DEFAULT_PRESSED_FONT_COLOR
    );
    expect(CHECKBOX_DEFAULT_PRESSED_FONT_COLOR).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });

  it('resolves control_font_disabled_color (alpha 0.5) for the disabled state', () => {
    expect(checkBoxTextTheme(node({}), {} as CheckBoxProperties, 'disabled', ctx()).color).toEqual(
      CHECKBOX_DEFAULT_DISABLED_FONT_COLOR
    );
    expect(CHECKBOX_DEFAULT_DISABLED_FONT_COLOR).toEqual({ r: 0.875, g: 0.875, b: 0.875, a: 0.5 });
  });

  it('a theme_override_colors/font_pressed_color override wins over the default', () => {
    const props: CheckBoxProperties = {
      name: 'C',
      themeOverrideColors: { font_pressed_color: { r: 1, g: 0, b: 0, a: 1 } },
    };
    expect(checkBoxTextTheme(node(props), props, 'pressed', ctx()).color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });
});

describe('resolveCheckBoxIconKey (check_box.cpp:112-131)', () => {
  it('unchecked, not radio, not disabled -> unchecked', () => {
    expect(resolveCheckBoxIconKey({} as CheckBoxProperties)).toBe('unchecked');
  });

  it('checked, not radio, not disabled -> checked', () => {
    expect(resolveCheckBoxIconKey({ buttonPressed: true } as CheckBoxProperties)).toBe('checked');
  });

  it('unchecked, disabled -> uncheckedDisabled', () => {
    expect(resolveCheckBoxIconKey({ disabled: true } as CheckBoxProperties)).toBe('uncheckedDisabled');
  });

  it('checked, disabled -> checkedDisabled', () => {
    expect(resolveCheckBoxIconKey({ buttonPressed: true, disabled: true } as CheckBoxProperties)).toBe(
      'checkedDisabled'
    );
  });

  it('unchecked, radio (button_group set) -> radioUnchecked', () => {
    expect(resolveCheckBoxIconKey({ buttonGroup: 'grp' } as CheckBoxProperties)).toBe('radioUnchecked');
  });

  it('checked, radio -> radioChecked', () => {
    expect(resolveCheckBoxIconKey({ buttonGroup: 'grp', buttonPressed: true } as CheckBoxProperties)).toBe(
      'radioChecked'
    );
  });

  it('unchecked, radio, disabled -> radioUncheckedDisabled', () => {
    expect(resolveCheckBoxIconKey({ buttonGroup: 'grp', disabled: true } as CheckBoxProperties)).toBe(
      'radioUncheckedDisabled'
    );
  });

  it('checked, radio, disabled -> radioCheckedDisabled', () => {
    expect(
      resolveCheckBoxIconKey({ buttonGroup: 'grp', buttonPressed: true, disabled: true } as CheckBoxProperties)
    ).toBe('radioCheckedDisabled');
  });
});

describe('checkBoxMinimumSize (check_box.cpp:64-79) — no text', () => {
  it('is 2*content_margin(4) + icon(16x16) — (24, 24) — even with no text at all', () => {
    expect(checkBoxMinimumSize(node({}), ctx())).toEqual({ x: 24, y: 24 });
  });
});

describe('checkBoxMinimumSize — with text', () => {
  it('adds text width + h_separation(4) alongside the icon width; height floors on the taller of text/icon', () => {
    const result = checkBoxMinimumSize(node({ text: 'AB' }), ctx());
    // width = 8 (2*margin) + 21.125 (text) + 4 (h_separation) + 16 (icon) = 49.125.
    expect(result.x).toBeCloseTo(8 + AB_SHAPED_WIDTH + 4 + 16, 6);
    // height = 8 + max(23, 16) = 31.
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('treats an absent measurer as "text contributes nothing" — icon-only floor still returns', () => {
    const result = checkBoxMinimumSize(node({ text: 'AB' }), ctx(false));
    expect(result).toEqual({ x: 24, y: 24 });
  });

  it('h_separation theme_override_constants wins over the theme default', () => {
    const result = checkBoxMinimumSize(node({ text: 'AB', themeOverrideConstants: { h_separation: 12 } }), ctx());
    expect(result.x).toBeCloseTo(8 + AB_SHAPED_WIDTH + 12 + 16, 6);
  });

  it('icon_max_width theme_override_constants clamps the (16x16) icon before it contributes', () => {
    const result = 
      checkBoxMinimumSize(node({ text: 'AB', themeOverrideConstants: { icon_max_width: 8 } }), ctx())
    ;
    // fitIconSize(16x16, 8) = 8x8.
    expect(result.x).toBeCloseTo(8 + AB_SHAPED_WIDTH + 4 + 8, 6);
    expect(result.y).toBe(8 + FONT_HEIGHT); // 8 < 23, text still floors height
  });
});

describe('CHECKBOX_ICON_NATURAL_SIZE', () => {
  it('is 16x16 — every vendored CheckBox icon shares this authored size', () => {
    expect(CHECKBOX_ICON_NATURAL_SIZE).toEqual({ x: 16, y: 16 });
  });
});

describe('checkBoxIconNaturalSize (check_box.cpp:35-62) — MAX over all 8 icons, not only the current draw state', () => {
  it('is the vendored 16x16 default when no icon is themed', () => {
    expect(checkBoxIconNaturalSize({ textureSlots: {} })).toEqual({ x: 16, y: 16 });
  });

  it('widens to a themed "checked" icon even while the widget draws "unchecked"', () => {
    // check_box.cpp:39-40: `tex_size = tex_size.max(theme_cache.unchecked->get_size())`
    // runs regardless of which icon is actually pressed/shown.
    expect(checkBoxIconNaturalSize({ textureSlots: { checked: { x: 24, y: 24 } } })).toEqual({ x: 24, y: 24 });
  });

  it('never shrinks below an unthemed icon\'s vendored default', () => {
    // Only "checked" themed smaller. The other 7 still default to 16x16.
    expect(checkBoxIconNaturalSize({ textureSlots: { checked: { x: 8, y: 8 } } })).toEqual({ x: 16, y: 16 });
  });
});

describe('checkBoxMinimumSize — a themed icon widens the minimum size (check_box.cpp:64-79)', () => {
  it('floors the width on the themed icon\'s own size, not the vendored 16x16', () => {
    const n = { ...node({}), textureSlots: { unchecked: { x: 24, y: 24 } } };
    // No text: content_size is the icon alone (check_box.cpp:66-79), then
    // `_get_largest_stylebox_size()` (cbx_empty's uniform content margin,
    // 4px at scale 1) is added back on every side: 24 + 2*4 = 32.
    expect(checkBoxMinimumSize(n, ctx())).toEqual({ x: 32, y: 32 });
  });
});

describe('layoutCheckBoxContent (check_box.cpp:126-133 + button.cpp:247-260,444-456)', () => {
  const BASE = {
    rectSize: { x: 150, y: 28 },
    margin: 4,
    iconSize: { x: 16, y: 16 },
    checkVOffset: 0,
    hSeparation: 4,
    hasText: true,
    textNaturalSize: { x: 90, y: 26 },
    rtl: false,
  };

  it('icon sits at (margin, vertically centred + check_v_offset)', () => {
    const { iconRect } = layoutCheckBoxContent(BASE);
    // y = floor((28-16)/2 + 0) = 6.
    expect(iconRect).toEqual({ x: 4, y: 6, w: 16, h: 16 });
  });

  it('text starts past the icon + h_separation (the reserved "internal margin" width)', () => {
    const { textOffset } = layoutCheckBoxContent(BASE);
    // x = margin(4) + icon(16) + h_separation(4) = 24.
    expect(textOffset!.x).toBe(24);
    // customElementHeight = 28-8=20; y = (20-26)/2 + 4 = -3+4 = 1.
    expect(textOffset!.y).toBeCloseTo(1, 10);
  });

  it('returns textOffset: null when hasText is false (icon still positioned)', () => {
    const { iconRect, textOffset } = layoutCheckBoxContent({ ...BASE, hasText: false });
    expect(textOffset).toBeNull();
    expect(iconRect).toEqual({ x: 4, y: 6, w: 16, h: 16 });
  });

  it('check_v_offset shifts the icon vertically (a rarely-set theme_override_constants key)', () => {
    const { iconRect } = layoutCheckBoxContent({ ...BASE, checkVOffset: 3 });
    expect(iconRect.y).toBe(9);
  });

  it('a wider/taller icon (icon_max_width clamp NOT applied — already-fitted input) shifts the text start accordingly', () => {
    const { textOffset } = layoutCheckBoxContent({ ...BASE, iconSize: { x: 8, y: 8 } });
    // x = 4 + 8 + 4 = 16.
    expect(textOffset!.x).toBe(16);
  });

  it('floors a half-pixel centring remainder DOWN, matching Button\'s own text_ofs.y (never floored in the source itself, only per-glyph — text_server_adv.cpp:4083)', () => {
    // customElementHeight = 32-2*4=24; (24-23)/2=0.5; +margin(4)=4.5 -> floor 4.
    const { textOffset } = layoutCheckBoxContent({
      ...BASE,
      rectSize: { x: 150, y: 32 },
      textNaturalSize: { x: 90, y: 23 },
    });
    expect(textOffset!.y).toBe(4);
  });
});

/**
 * The RTL arms: the icon sits at `get_size().x - margin(SIDE_RIGHT) - icon width` (check_box.cpp:129),
 * and the internal margin moves to SIDE_RIGHT (`:98-100`). The constructor's LEFT alignment (`:174`)
 * swaps to RIGHT (`button.cpp:271-275`), so the label hugs the far end of what is left.
 */
describe('layoutCheckBoxContent — RTL puts the check on the right and the label against it', () => {
  const BASE = {
    rectSize: { x: 150, y: 28 },
    margin: 4,
    iconSize: { x: 16, y: 16 },
    checkVOffset: 0,
    hSeparation: 4,
    hasText: true,
    textNaturalSize: { x: 90, y: 26 },
    rtl: true,
  };

  it('draws the check at the right content margin', () => {
    const { iconRect } = layoutCheckBoxContent(BASE);
    // x = 150 - 4 - 16 = 130; y is direction-independent: floor((28-16)/2) = 6.
    expect(iconRect).toEqual({ x: 130, y: 6, w: 16, h: 16 });
  });

  it('lays the label out flush against the check', () => {
    const { textOffset } = layoutCheckBoxContent(BASE);
    // drawable = 150 - 4 - 4 - (16 + 4) = 122; text_ofs.x = style margin 4
    // (the left internal margin is now 0) + RIGHT shift (122 - 90) = 36.
    expect(textOffset!.x).toBe(36);
    expect(textOffset!.y).toBeCloseTo(1, 10);
  });

  it('hugs the CEILED paragraph width, not the raw drawable (button.cpp:437)', () => {
    // rect 150.5 -> drawable 122.5 -> text_buf_width 123; 123 - 90 = 33; + margin 4.
    const { textOffset } = layoutCheckBoxContent({ ...BASE, rectSize: { x: 150.5, y: 28 } });
    expect(textOffset!.x).toBeCloseTo(37, 10);
  });

  it('keeps check_v_offset and the no-text case direction-independent', () => {
    expect(layoutCheckBoxContent({ ...BASE, checkVOffset: 3 }).iconRect.y).toBe(9);
    const { textOffset, iconRect } = layoutCheckBoxContent({ ...BASE, hasText: false });
    expect(textOffset).toBeNull();
    expect(iconRect.x).toBe(130);
  });
});

describe(`checkBoxMinimumSize — resolves this CheckBox's own theme font key ("${CHECKBOX_THEME_FONT_KEY}", default_theme.cpp:297)`, () => {
  // An unresolvable font's warning is the observable proof here, not a resolved
  // value (`resolveNodeFontMetrics.test.ts` gives the reason).
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it("a theme_override_fonts/font local override is fed to the text engine (also threaded through TextMeasurer, not just shapeText)", () => {
    const systemFont: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const n: SolveNode = { ...node({ text: 'A' }), fontOverrides: { [CHECKBOX_THEME_FONT_KEY]: systemFont } };
    checkBoxMinimumSize(n, ctx());
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('a local override under a different key is not consulted', () => {
    const systemFont: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const n: SolveNode = { ...node({ text: 'A' }), fontOverrides: { normal_font: systemFont } };
    checkBoxMinimumSize(n, ctx());
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('resolves the font key even for empty text (unconditional, not gated behind hasText)', () => {
    const systemFont: FontResource = { kind: 'system', fontNames: ['sans-serif'], properties: {} };
    const n: SolveNode = { ...node({}), fontOverrides: { [CHECKBOX_THEME_FONT_KEY]: systemFont } };
    checkBoxMinimumSize(n, ctx());
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

/**
 * The icon and separation add to Button's ceiled text extent (`button.cpp:492`,
 * `text_paragraph.cpp:601-608`, `text_server_adv.cpp:7524-7537`). Measured in Godot 4.6.3 on
 * `scenes/fixtures/complex-2d-gui.tscn` at 1152x648: SystemsGrid/Subtitles is (222, 31).
 */
describe('checkBoxMinimumSize — the shaped text extent is ceiled (text_server_adv.cpp:7524-7537)', () => {
  it("'Transcribe squad chatter' reaches Godot's own whole-pixel minimum width 222", () => {
    expect(checkBoxMinimumSize(node({ text: 'Transcribe squad chatter' }), ctx()).x).toBe(222);
  });

  it('keeps the icon and separation OUT of the ceil — an empty CheckBox is unchanged by it', () => {
    expect(checkBoxMinimumSize(node({}), ctx()).x).toBe(
      checkBoxMinimumSize(node({ text: '' }), ctx()).x
    );
  });
});
