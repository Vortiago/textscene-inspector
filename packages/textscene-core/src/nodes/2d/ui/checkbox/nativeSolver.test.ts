/**
 * `checkbox/nativeSolver.ts` against Godot 4.6.3 (`scene/gui/check_box.cpp`,
 * `scene/theme/default_theme.cpp:274-313`), hand-derived from OpenSans SemiBold (unitsPerEm 2048,
 * ascent 2189, descent 600). At 16px a CheckBox floors on the font height 18 + 5 = 23: it sets no
 * `line_spacing`. `textOffset` is the paragraph's box top-left, and `<TextRun>` owns the line anchor.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fontFile } from '../../../../r3f/controls/native/text/sfntOutlines.testkit';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import * as logger from '../../../../logger';
import type { CheckBoxProperties } from './types';
import {
  checkBoxFittedIconSize,
  checkBoxDrawnIconSize,
  checkBoxMinimumSize,
  checkBoxTextTheme,
  resolveCheckBoxDrawState,
  resolveCheckBoxIconKey,
  layoutCheckBoxContent,
  checkBoxTextureSlots,
  CHECKBOX_THEME_FONT_KEY,
} from './nativeSolver';
import {
  internalMarginAt,
  type ButtonContentFacts,
  type ButtonContentInput,
} from '../../../../r3f/controls/native/buttonBase';
import { controlNode, solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { controlProps } from '../control/testing/controlProps';

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
    node: controlNode('C', 'CheckBox', { name: 'C', ...props }),
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
    expect(resolveCheckBoxDrawState({ buttonPressed: true, disabled: true } as CheckBoxProperties)).toBe(
      'disabled'
    );
  });
});

describe('checkBoxTextTheme', () => {
  it('resolves control_font_color (0.875 opaque) for the normal state', () => {
    // default_theme.cpp:101,300: control_font_color.
    expect(checkBoxTextTheme(node({}), {} as CheckBoxProperties, 'normal', ctx())).toEqual({
      fontSizePx: 16,
      color: { r: 0.875, g: 0.875, b: 0.875, a: 1 },
    });
  });

  it('resolves control_font_pressed_color (opaque white) for the pressed (checked) state', () => {
    // default_theme.cpp:108,301: control_font_pressed_color.
    expect(checkBoxTextTheme(node({}), {} as CheckBoxProperties, 'pressed', ctx()).color).toEqual({
      r: 1,
      g: 1,
      b: 1,
      a: 1,
    });
  });

  it('resolves control_font_disabled_color (alpha 0.5) for the disabled state', () => {
    // default_theme.cpp:106,305: control_font_disabled_color.
    expect(checkBoxTextTheme(node({}), {} as CheckBoxProperties, 'disabled', ctx()).color).toEqual({
      r: 0.875,
      g: 0.875,
      b: 0.875,
      a: 0.5,
    });
  });

  it('a theme_override_colors/font_pressed_color override wins over the default', () => {
    const props: CheckBoxProperties = controlProps({
      name: 'C',
      textDirection: 0,
      language: '',
      themeOverrideColors: { font_pressed_color: { r: 1, g: 0, b: 0, a: 1 } },
    });
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
      resolveCheckBoxIconKey({
        buttonGroup: 'grp',
        buttonPressed: true,
        disabled: true,
      } as CheckBoxProperties)
    ).toBe('radioCheckedDisabled');
  });
});

describe('checkBoxMinimumSize (check_box.cpp:64-79): no text', () => {
  it('is 2*content_margin(4) + icon(16x16) — (24, 24) — even with no text at all', () => {
    expect(checkBoxMinimumSize(node({}), ctx())).toEqual({ x: 24, y: 24 });
  });
});

describe('checkBoxMinimumSize: with text', () => {
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
    const result = checkBoxMinimumSize(
      node({ text: 'AB', themeOverrideConstants: { h_separation: 12 } }),
      ctx()
    );
    expect(result.x).toBeCloseTo(8 + AB_SHAPED_WIDTH + 12 + 16, 6);
  });

  it('icon_max_width theme_override_constants clamps the (16x16) icon before it contributes', () => {
    const result = checkBoxMinimumSize(
      node({ text: 'AB', themeOverrideConstants: { icon_max_width: 8 } }),
      ctx()
    );
    // fitIconSize(16x16, 8) = 8x8.
    expect(result.x).toBeCloseTo(8 + AB_SHAPED_WIDTH + 4 + 8, 6);
    expect(result.y).toBe(8 + FONT_HEIGHT); // 8 < 23, text still floors height
  });
});

describe('checkBoxFittedIconSize (check_box.cpp:35-62): MAX over all 8 icons, not only the current draw state', () => {
  it('is the vendored 16x16 default when no icon is themed', () => {
    expect(checkBoxFittedIconSize({ textureSlots: {}, constants: {} })).toEqual({ x: 16, y: 16 });
  });

  it('widens to a themed "checked" icon even while the widget draws "unchecked"', () => {
    // check_box.cpp:39-40: `tex_size = tex_size.max(theme_cache.unchecked->get_size())`
    // runs regardless of which icon is actually pressed/shown.
    expect(checkBoxFittedIconSize({ textureSlots: { checked: { x: 24, y: 24 } }, constants: {} })).toEqual({
      x: 24,
      y: 24,
    });
  });

  it("never shrinks below an unthemed icon's vendored default", () => {
    // Only "checked" themed smaller. The other 7 still default to 16x16.
    expect(checkBoxFittedIconSize({ textureSlots: { checked: { x: 8, y: 8 } }, constants: {} })).toEqual({
      x: 16,
      y: 16,
    });
  });
});

describe('checkBoxMinimumSize: a themed icon widens the minimum size (check_box.cpp:64-79)', () => {
  it("floors the width on the themed icon's own size, not the vendored 16x16", () => {
    const n = { ...node({}), textureSlots: { unchecked: { x: 24, y: 24 } } };
    // No text: content_size is the icon alone (check_box.cpp:66-79), then
    // `_get_largest_stylebox_size()` (cbx_empty's uniform content margin,
    // 4px at scale 1) is added back on every side: 24 + 2*4 = 32.
    expect(checkBoxMinimumSize(n, ctx())).toEqual({ x: 32, y: 32 });
  });
});

/**
 * What `layoutButtonContent` reads of a 150x28 CheckBox: `cbx_empty`'s margin 4 on every side, the label
 * 26 px high, and the vendored 16 px check, which `layoutCheckBoxContent` reserves as the internal margin.
 */
const CONTENT: ButtonContentFacts & Pick<ButtonContentInput, 'textNaturalSize' | 'isTextRtl'> = {
  rectSize: { x: 150, y: 28 },
  styleMargin: { left: 4, top: 4, right: 4, bottom: 4 },
  hSeparation: 4,
  iconMaxWidth: 0,
  textAlignment: 0,
  iconAlignment: 0,
  verticalIconAlignment: 1,
  expandIcon: false,
  iconNaturalSize: null,
  hasText: true,
  textNaturalSize: { x: 40, y: 26 },
  isTextRtl: false,
  isClipped: false,
  internalMargin: { left: 0, right: 0 },
  rtl: false,
};
/** The facts the painter builds: the check's width reserved on its side (`check_box.cpp:96-101`). */
function layoutWithCheck(input: Parameters<typeof layoutCheckBoxContent>[0]) {
  const { content, checkSize } = input;
  const internalMargin = internalMarginAt(content.rtl ? 'right' : 'left', checkSize.x);
  return layoutCheckBoxContent({ ...input, content: { ...content, internalMargin } });
}

const BASE = { content: CONTENT, checkSize: { x: 16, y: 16 }, checkVOffset: 0 };
const WITH_BUTTON_ICON = { ...CONTENT, iconNaturalSize: { x: 12, y: 12 } };

describe('layoutCheckBoxContent (check_box.cpp:126-133 + button.cpp:247-260,444-456)', () => {
  it('check sits at (margin, vertically centred + check_v_offset)', () => {
    const { checkPosition } = layoutWithCheck(BASE);
    // y = floor((28-16)/2 + 0) = 6.
    expect(checkPosition).toEqual({ x: 4, y: 6 });
  });

  it('the label box starts past the check + h_separation (the reserved "internal margin" width)', () => {
    const { labelBox } = layoutWithCheck(BASE);
    // leftPx = margin(4) + check(16) + h_separation(4) = 24; width = 150 - 8 - 20 = 122.
    expect(labelBox!.leftPx).toBe(24);
    expect(labelBox!.widthPx).toBe(122);
    // customElementHeight = 28-8=20; topPx = (20-26)/2 + 4 = -3+4 = 1.
    expect(labelBox!.topPx).toBeCloseTo(1, 10);
  });

  it('returns labelBox: null when hasText is false (check still positioned)', () => {
    const { checkPosition, labelBox } = layoutWithCheck({
      ...BASE,
      content: { ...CONTENT, hasText: false },
    });
    expect(labelBox).toBeNull();
    expect(checkPosition).toEqual({ x: 4, y: 6 });
  });

  it('check_v_offset shifts the check vertically (a rarely-set theme_override_constants key)', () => {
    const { checkPosition } = layoutWithCheck({ ...BASE, checkVOffset: 3 });
    expect(checkPosition.y).toBe(9);
  });

  it('a smaller check (icon_max_width clamp NOT applied: already-fitted input) moves the label box accordingly', () => {
    const { labelBox } = layoutWithCheck({ ...BASE, checkSize: { x: 8, y: 8 } });
    // leftPx = 4 + 8 + 4 = 16; width = 150 - 8 - 12 = 130.
    expect(labelBox!.leftPx).toBe(16);
    expect(labelBox!.widthPx).toBe(130);
  });

  it("floors a half-pixel centring remainder DOWN, matching Button's own text_ofs.y (never floored in the source itself, only per-glyph: text_server_adv.cpp:4083)", () => {
    // customElementHeight = 32-2*4=24; (24-23)/2=0.5; +margin(4)=4.5 -> floor 4.
    const { labelBox } = layoutWithCheck({
      ...BASE,
      content: { ...CONTENT, rectSize: { x: 150, y: 32 }, textNaturalSize: { x: 40, y: 23 } },
    });
    expect(labelBox!.topPx).toBe(4);
  });

  it('keeps the authored alignment (check_box.cpp:174 sets LEFT only as the default)', () => {
    expect(layoutWithCheck({ ...BASE, content: { ...CONTENT, textAlignment: 1 } }).labelBox!.alignment).toBe(
      1
    );
    expect(layoutWithCheck({ ...BASE, content: { ...CONTENT, textAlignment: 2 } }).labelBox!.alignment).toBe(
      2
    );
  });

  it('keeps the unceiled drawable width: the ceiling belongs to the drawn label (button.cpp:437)', () => {
    const wide = { ...CONTENT, rectSize: { x: 150.5, y: 28 } };
    expect(layoutWithCheck({ ...BASE, content: wide }).labelBox!.widthPx).toBe(122.5);
  });

  it('draws no Button icon without one', () => {
    expect(layoutWithCheck(BASE).icon).toBeNull();
  });

  it("draws Button's LEFT icon past the check and its separation, and the label past both (button.cpp:374-381,411-423)", () => {
    const { icon, labelBox } = layoutWithCheck({ ...BASE, content: WITH_BUTTON_ICON });
    // x = margin 4 + (check 16 + 4) = 24; y = floor(4 + (20 - 12) / 2) = 8. The label starts at 24 + (12 + 4) = 40.
    expect(icon).toEqual({ rect: { x: 24, y: 8, w: 12, h: 12 } });
    expect(labelBox).toMatchObject({ leftPx: 40, widthPx: 122 - 16 });
  });

  it("draws Button's RIGHT icon at the right margin, the check being on the left (button.cpp:385-387)", () => {
    const { icon, labelBox } = layoutWithCheck({
      ...BASE,
      content: { ...WITH_BUTTON_ICON, iconAlignment: 2 },
    });
    // x = 150 - 4 - 12 = 134.
    expect(icon!.rect.x).toBe(134);
    expect(labelBox).toMatchObject({ leftPx: 24, widthPx: 122 - 16 });
  });

  it("centres Button's CENTER icon in the box the check leaves (button.cpp:374-381)", () => {
    const { icon, labelBox } = layoutWithCheck({
      ...BASE,
      content: { ...WITH_BUTTON_ICON, iconAlignment: 1 },
    });
    // x = 4 + 20 + (122 - 12) / 2 = 79; the label box keeps its whole width.
    expect(icon!.rect.x).toBe(79);
    expect(labelBox).toMatchObject({ leftPx: 24, widthPx: 122 });
  });
});

/**
 * The RTL arms: the check sits at `get_size().x - margin(SIDE_RIGHT) - icon width` (check_box.cpp:129),
 * and the internal margin moves to SIDE_RIGHT (`:98-100`). The constructor's LEFT alignment (`:174`)
 * swaps to RIGHT (`button.cpp:271-275`), so the label hugs the far end of what is left.
 */
describe('layoutCheckBoxContent: RTL puts the check on the right and the label against it', () => {
  const RTL = { ...BASE, content: { ...CONTENT, rtl: true } };

  it('draws the check at the right content margin', () => {
    const { checkPosition } = layoutWithCheck(RTL);
    // x = 150 - 4 - 16 = 130; y is direction-independent: floor((28-16)/2) = 6.
    expect(checkPosition).toEqual({ x: 130, y: 6 });
  });

  it('puts the label box at the left margin, 20 px short of the check, aligned RIGHT', () => {
    const { labelBox } = layoutWithCheck(RTL);
    // drawable = 150 - 4 - 4 - (16 + 4) = 122; the left internal margin is now 0.
    expect(labelBox).toEqual({ leftPx: 4, topPx: 1, widthPx: 122, alignment: 2 });
  });

  it('swaps an authored RIGHT to LEFT and leaves CENTER (button.cpp:271-275)', () => {
    expect(
      layoutWithCheck({ ...RTL, content: { ...RTL.content, textAlignment: 2 } }).labelBox!.alignment
    ).toBe(0);
    expect(
      layoutWithCheck({ ...RTL, content: { ...RTL.content, textAlignment: 1 } }).labelBox!.alignment
    ).toBe(1);
  });

  it('keeps check_v_offset and the no-text case direction-independent', () => {
    expect(layoutWithCheck({ ...RTL, checkVOffset: 3 }).checkPosition.y).toBe(9);
    const { labelBox, checkPosition } = layoutWithCheck({
      ...RTL,
      content: { ...RTL.content, hasText: false },
    });
    expect(labelBox).toBeNull();
    expect(checkPosition.x).toBe(130);
  });

  it("draws Button's LEFT icon at the right edge, short of the check, under RTL (button.cpp:262-276,385-387)", () => {
    const { icon } = layoutWithCheck({ ...RTL, content: { ...WITH_BUTTON_ICON, rtl: true } });
    // The icon's side swaps to RIGHT: x = 150 - 4 - (16 + 4) - 12 = 114.
    expect(icon!.rect.x).toBe(114);
  });
});

describe("checkBoxMinimumSize: Button's inherited icon (check_box.cpp:64-79, button.cpp:481-526)", () => {
  const withIcon = (props: Partial<CheckBoxProperties>, size = { x: 12, y: 12 }): SolveNode => ({
    ...node(props),
    textureSlots: { icon: size },
  });

  it('adds the icon and a separation between it and the check, though there is no text', () => {
    // content = 12; the check adds h_separation 4 (the content is wider than 0) and 16: 8 + 12 + 4 + 16.
    expect(checkBoxMinimumSize(withIcon({}), ctx())).toEqual({ x: 40, y: 8 + 16 });
  });

  it('adds the icon, its separation to the text, and the check', () => {
    const result = checkBoxMinimumSize(withIcon({ text: 'AB' }), ctx());
    // 8 + (22 + 4 + 12) + 4 + 16.
    expect(result).toEqual({ x: 8 + AB_SHAPED_WIDTH + 4 + 12 + 4 + 16, y: 8 + FONT_HEIGHT });
  });

  it('stacks the icon above the text for a TOP icon, and adds the font height again (button.cpp:497-502,517-521)', () => {
    const result = checkBoxMinimumSize(withIcon({ text: 'AB', verticalIconAlignment: 0 }), ctx());
    expect(result.y).toBe(8 + FONT_HEIGHT + 12 + FONT_HEIGHT);
  });

  it('takes the wider of icon and text for a CENTER icon (button.cpp:510-512)', () => {
    const result = checkBoxMinimumSize(withIcon({ text: 'AB', iconAlignment: 1 }, { x: 40, y: 12 }), ctx());
    expect(result.x).toBe(8 + 40 + 4 + 16);
  });

  it('clamps the icon to icon_max_width before it contributes (button.cpp:471-480)', () => {
    const n = { ...withIcon({ themeOverrideConstants: { icon_max_width: 8 } }, { x: 32, y: 32 }) };
    expect(checkBoxMinimumSize(n, ctx()).x).toBe(8 + 8 + 4 + 8);
  });

  it('adds no icon for expand_icon (button.cpp:497)', () => {
    expect(checkBoxMinimumSize(withIcon({ expandIcon: true }), ctx())).toEqual(
      checkBoxMinimumSize(node({}), ctx())
    );
  });

  it('takes the icon and the check off the width a wrapping label shapes at (button.cpp:428-432)', () => {
    // Wraps at 80 - 8 - 20 = 52 for the check alone: 'AB AB' is 46.6 px, one row. With a 12 px icon it
    // is 52 - 16 = 36 px: two rows.
    const tentative: SolveContext = { ...ctx(), tentativeRect: () => ({ x: 0, y: 0, w: 80, h: 60 }) };
    const props = { text: 'AB AB', autowrapMode: 2 };
    expect(checkBoxMinimumSize(node(props), tentative).y).toBe(8 + FONT_HEIGHT);
    expect(checkBoxMinimumSize(withIcon(props), tentative).y).toBe(8 + 2 * FONT_HEIGHT);
  });
});

describe("checkBoxTextureSlots: Button's own icon property", () => {
  const nodeWithIcon = (icon?: string) =>
    controlNode('C', 'CheckBox', { name: 'C', ...(icon ? { icon } : {}) });

  it('requests the icon ref first, so `textureSize` is the icon, as it is for a Button', () => {
    expect(checkBoxTextureSlots(nodeWithIcon('ExtResource("1")'), {})).toEqual([
      { key: 'icon', ref: 'ExtResource("1")' },
    ]);
  });

  it('requests nothing for no icon', () => {
    expect(checkBoxTextureSlots(nodeWithIcon(), {})).toEqual([]);
  });
});

describe(`checkBoxMinimumSize: resolves this CheckBox's own theme font key ("${CHECKBOX_THEME_FONT_KEY}", default_theme.cpp:297)`, () => {
  // An unresolvable font's warning is the observable proof here, not a resolved
  // value (`resolveNodeFontMetrics.test.ts` gives the reason).
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('a theme_override_fonts/font local override is fed to the text engine (also threaded through TextMeasurer, not just shapeText)', () => {
    const unresolvableFont = fontFile(undefined);
    const n: SolveNode = {
      ...node({ text: 'A' }),
      fontOverrides: { [CHECKBOX_THEME_FONT_KEY]: unresolvableFont },
    };
    checkBoxMinimumSize(n, ctx());
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('a local override under a different key is not consulted', () => {
    const unresolvableFont = fontFile(undefined);
    const n: SolveNode = { ...node({ text: 'A' }), fontOverrides: { normal_font: unresolvableFont } };
    checkBoxMinimumSize(n, ctx());
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('resolves the font key even for empty text (unconditional, not gated behind hasText)', () => {
    const unresolvableFont = fontFile(undefined);
    const n: SolveNode = { ...node({}), fontOverrides: { [CHECKBOX_THEME_FONT_KEY]: unresolvableFont } };
    checkBoxMinimumSize(n, ctx());
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

/**
 * The icon and separation add to Button's ceiled text extent (`button.cpp:492`,
 * `text_paragraph.cpp:601-608`, `text_server_adv.cpp:7524-7537`). Measured in Godot 4.6.3 on
 * `scenes/fixtures/complex-2d-gui.tscn` at 1152x648: SystemsGrid/Subtitles is (222, 31).
 */
describe('checkBoxMinimumSize: the shaped text extent is ceiled (text_server_adv.cpp:7524-7537)', () => {
  it("'Transcribe squad chatter' reaches Godot's own whole-pixel minimum width 222", () => {
    expect(checkBoxMinimumSize(node({ text: 'Transcribe squad chatter' }), ctx()).x).toBe(222);
  });

  it('keeps the icon and separation OUT of the ceil — an empty CheckBox is unchanged by it', () => {
    expect(checkBoxMinimumSize(node({}), ctx()).x).toBe(checkBoxMinimumSize(node({ text: '' }), ctx()).x);
  });
});

/** Godot draws the current icon at its own fitted size, placed by the largest (`check_box.cpp:137-142`). */
describe('checkBoxDrawnIconSize', () => {
  it("is the current icon's own size, not the largest icon's", () => {
    const n = { textureSlots: { checked: { x: 32, y: 32 } }, constants: {} };
    expect(checkBoxDrawnIconSize(n, 'unchecked')).toEqual({ x: 16, y: 16 });
  });

  it('is 0 for an icon that reports size 0, as an unset ViewportTexture does', () => {
    const n = { textureSlots: { unchecked: { x: 0, y: 0 } }, constants: {} };
    expect(checkBoxDrawnIconSize(n, 'unchecked')).toEqual({ x: 0, y: 0 });
  });
});

describe('checkBoxMinimumSize: clip_text zeroes the text width (button.cpp:493-495)', () => {
  it('keeps the icon, the margins and the text height, and drops the text width and the h_separation', () => {
    const result = checkBoxMinimumSize(node({ text: 'AB', clipText: true }), ctx());
    expect(result).toEqual({ x: 8 + 16, y: 8 + FONT_HEIGHT });
  });

  it('keeps the whole text width without clip_text', () => {
    const result = checkBoxMinimumSize(node({ text: 'AB', clipText: false }), ctx());
    expect(result.x).toBe(8 + AB_SHAPED_WIDTH + 4 + 16);
  });
});

describe('checkBoxMinimumSize: a trimming text_overrun_behavior zeroes the text width (button.cpp:493-495)', () => {
  it('drops the text width and the h_separation under OVERRUN_TRIM_ELLIPSIS', () => {
    const result = checkBoxMinimumSize(node({ text: 'AB', overrunBehavior: 3 }), ctx());
    expect(result).toEqual({ x: 8 + 16, y: 8 + FONT_HEIGHT });
  });

  it('keeps the whole text width under OVERRUN_NO_TRIMMING', () => {
    const result = checkBoxMinimumSize(node({ text: 'AB', overrunBehavior: 0 }), ctx());
    expect(result.x).toBe(8 + AB_SHAPED_WIDTH + 4 + 16);
  });
});

describe('checkBoxMinimumSize: autowrap_mode wraps the label at the tentative width (button.cpp:429-432,493-495)', () => {
  const text = 'alpha bravo charlie';

  function minSize(props: Partial<CheckBoxProperties>, tentativeWidthPx?: number) {
    const context: SolveContext = {
      ...ctx(),
      ...(tentativeWidthPx === undefined
        ? {}
        : { tentativeRect: () => ({ x: 0, y: 0, w: tentativeWidthPx, h: 40 }) }),
    };
    return checkBoxMinimumSize(node(props), context);
  }

  it('drops the text width and the h_separation, keeping the margins and the check', () => {
    expect(minSize({ text, autowrapMode: 2 }).x).toBe(minSize({}).x);
  });

  it('grows to one font height per wrapped row at a narrow tentative width', () => {
    expect(minSize({ text, autowrapMode: 2 }, 80).y).toBe(8 + 3 * FONT_HEIGHT);
  });

  it('stays one row high until a tentative width is known', () => {
    expect(minSize({ text, autowrapMode: 2 }).y).toBe(8 + FONT_HEIGHT);
  });

  it('never wraps at AUTOWRAP_OFF, whatever the tentative width says', () => {
    expect(minSize({ text }, 80).y).toBe(8 + FONT_HEIGHT);
  });
});
