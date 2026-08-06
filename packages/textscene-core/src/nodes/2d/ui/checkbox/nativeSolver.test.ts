/**
 * `checkbox/nativeSolver.ts` vs Godot 4.6.3 (`scene/gui/check_box.cpp`,
 * `scene/theme/default_theme.cpp:274-313`). Expected numbers are hand-derived
 * from the source, NOT recomputed the way the implementation itself computes
 * them (`AGENTS.md`'s test-authoring rule) — same vendored OpenSans_SemiBold
 * metrics/atlas `button/nativeSolver.test.ts` cites (`unitsPerEm=2048`,
 * `ascent=2189`, `descent=600`; `hmtx` advance width for 'A' is 1354 design
 * units — `openSansMetrics.ts`'s CONTINUOUS `advanceWidths`, not
 * `openSansAtlas.ts`'s own atlas-bake-resolution-42 `xadvance`).
 *
 * At font size 16 a CheckBox floors on `font->get_height()` = ascent +
 * descent = 23 (`ascentPx=ceil(2189*16/2048)=18`,
 * `descentPx=ceil(600*16/2048)=5`). `line_spacing` is Label's own theme
 * constant; CheckBox sets none.
 * 'A' advance at 16px = 1354*(16/2048) = 10.578125; 'AB' = (1354+1350)*(16/2048) = 21.125.
 * `textOffset` is the paragraph's own BOX TOP-LEFT — the MSDF bake's own line
 * anchor is `<TextRun>`'s to reconcile (`TextRun.test.tsx` pins it).
 *
 * A CHECKED (`button_pressed=true`), non-disabled CheckBox draws `DRAW_PRESSED`
 * per `BaseButton::get_draw_mode` (`base_button.cpp:325-358`) since a static
 * preview never sets `hovering`/`press_attempt` — verified against
 * `pnpm ref:godot scenes/fixtures/unit-checkbox.tscn --mode 2d`: the checked
 * row's label reads pure white (255,255,255) at probe (527,298), not the 0.875
 * gray a `DRAW_NORMAL` label would read; the disabled row's label reads
 * rgb(150,150,150) at probe (526,350) — `font_disabled_color` (0.875 * alpha
 * 0.5) blended over the 76,76,76 clear colour: `0.5*223 + 0.5*76 = 149.5`.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext, MinimumSizeResult } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { FontResource } from '../../../../resources/processing/fontProcessing';
import * as logger from '../../../../logger';
import type { CheckBoxProperties } from './types';
import {
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

// 'A's hmtx advance width is 1354 design units, 'B's is 1350 — a DIFFERENT
// glyph, so 'AB's width is their SUM (the two only coincided at the OLD
// atlas-bake-resolution-42 xadvance, where both rounded to the integer 28 —
// a coincidence of that rounding, not a fact about the font).
const AB_WIDTH = (1354 + 1350) * (16 / 2048); // 21.125
const FONT_HEIGHT = 23;

function node(props: Partial<CheckBoxProperties>): SolveNode {
  return {
    ...solveNode(),
    path: 'C',
    node: { name: 'C', type: 'CheckBox', children: [], properties: { name: 'C', ...props } as CheckBoxProperties },
  };
}

/** `checkBoxMinimumSize`'s `size` half only — see `MinimumSizeResult`'s own doc for why the union is here at all. */
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
    const result = size(checkBoxMinimumSize(node({ text: 'AB' }), ctx()));
    // width = 8 (2*margin) + 21.125 (text) + 4 (h_separation) + 16 (icon) = 49.125.
    expect(result.x).toBeCloseTo(8 + AB_WIDTH + 4 + 16, 6);
    // height = 8 + max(23, 16) = 31.
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('treats an absent measurer as "text contributes nothing" — icon-only floor still returns', () => {
    const result = checkBoxMinimumSize(node({ text: 'AB' }), ctx(false));
    expect(result).toEqual({ x: 24, y: 24 });
  });

  it('h_separation theme_override_constants wins over the theme default', () => {
    const result = size(checkBoxMinimumSize(node({ text: 'AB', themeOverrideConstants: { h_separation: 12 } }), ctx()));
    expect(result.x).toBeCloseTo(8 + AB_WIDTH + 12 + 16, 6);
  });

  it('icon_max_width theme_override_constants clamps the (16x16) icon before it contributes', () => {
    const result = size(
      checkBoxMinimumSize(node({ text: 'AB', themeOverrideConstants: { icon_max_width: 8 } }), ctx())
    );
    // fitIconSize(16x16, 8) = 8x8.
    expect(result.x).toBeCloseTo(8 + AB_WIDTH + 4 + 8, 6);
    expect(result.y).toBe(8 + FONT_HEIGHT); // 8 < 23, text still floors height
  });
});

describe('CHECKBOX_ICON_NATURAL_SIZE', () => {
  it('is 16x16 — every vendored CheckBox icon shares this authored size', () => {
    expect(CHECKBOX_ICON_NATURAL_SIZE).toEqual({ x: 16, y: 16 });
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
});

describe(`checkBoxMinimumSize — resolves this CheckBox's own theme font key ("${CHECKBOX_THEME_FONT_KEY}", default_theme.cpp:297)`, () => {
  // See `resolveNodeFontMetrics.test.ts`'s own doc for why an UNRESOLVABLE
  // font's warn is the observable proof here, not a resolved FontMetrics value.
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
