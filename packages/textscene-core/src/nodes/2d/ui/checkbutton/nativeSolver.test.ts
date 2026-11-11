/**
 * `checkbutton/nativeSolver.ts` against Godot 4.6.3 (`scene/gui/check_button.cpp`,
 * `scene/theme/default_theme.cpp:316-353`), hand-derived from OpenSans SemiBold (unitsPerEm 2048,
 * ascent 2189, descent 600, 'A' 1354, 'B' 1350). At 16px the font height is 18 + 5 = 23, and
 * 'AB' advances 21.125, shaped to 22.
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import type { CheckButtonProperties } from './types';
import {
  checkButtonContentFacts,
  checkButtonMinimumSize,
  checkButtonTextTheme,
  resolveCheckButtonDrawState,
  resolveCheckButtonIconKey,
  checkButtonIconColor,
  layoutCheckButtonContent,
  checkButtonDrawnIconSize,
  checkButtonTextureSlots,
} from './nativeSolver';
import { controlNode, solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { controlProps } from '../control/testing/controlProps';
import {
  buttonDrawnLabel,
  internalMarginAt,
  type ButtonContentFacts,
  type ButtonContentInput,
} from '../../../../r3f/controls/native/buttonBase';

const AB_WIDTH = (1354 + 1350) * (16 / 2048); // 21.125
const AB_SHAPED_WIDTH = Math.ceil(AB_WIDTH); // 22
const FONT_HEIGHT = 23;

function node(props: Partial<CheckButtonProperties>): SolveNode {
  return {
    ...solveNode(),
    path: 'CB',
    node: controlNode('CB', 'CheckButton', { name: 'CB', ...props }),
    // A local theme_override_colors/* reaches `resolveTextTheme` through
    // `n.colors`, which the walker folds in, not through props.
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

describe('resolveCheckButtonDrawState', () => {
  it('is "normal" when neither pressed nor disabled', () => {
    expect(resolveCheckButtonDrawState({} as CheckButtonProperties)).toBe('normal');
  });

  it('is "pressed" when button_pressed is true and not disabled', () => {
    expect(resolveCheckButtonDrawState({ buttonPressed: true } as CheckButtonProperties)).toBe('pressed');
  });

  it('is "disabled" when disabled is true, even if also pressed (disabled wins)', () => {
    expect(
      resolveCheckButtonDrawState({ buttonPressed: true, disabled: true } as CheckButtonProperties)
    ).toBe('disabled');
  });
});

describe('checkButtonTextTheme', () => {
  it('resolves control_font_color for the normal state', () => {
    // default_theme.cpp:101,340: control_font_color.
    expect(checkButtonTextTheme(node({}), {} as CheckButtonProperties, 'normal', ctx()).color).toEqual({
      r: 0.875,
      g: 0.875,
      b: 0.875,
      a: 1,
    });
  });

  it('resolves control_font_pressed_color (opaque white) for the pressed state', () => {
    // default_theme.cpp:108,341: control_font_pressed_color.
    expect(checkButtonTextTheme(node({}), {} as CheckButtonProperties, 'pressed', ctx()).color).toEqual({
      r: 1,
      g: 1,
      b: 1,
      a: 1,
    });
  });

  it('resolves control_font_disabled_color (alpha 0.5) for the disabled state', () => {
    // default_theme.cpp:106,345: control_font_disabled_color.
    expect(checkButtonTextTheme(node({}), {} as CheckButtonProperties, 'disabled', ctx()).color).toEqual({
      r: 0.875,
      g: 0.875,
      b: 0.875,
      a: 0.5,
    });
  });

  it('a theme_override_colors/font_color override wins over the default', () => {
    const props: CheckButtonProperties = controlProps({
      name: 'CB',
      textDirection: 0,
      language: '',
      themeOverrideColors: { font_color: { r: 1, g: 0, b: 0, a: 1 } },
    });
    expect(checkButtonTextTheme(node(props), props, 'normal', ctx()).color).toEqual({
      r: 1,
      g: 0,
      b: 0,
      a: 1,
    });
  });
});

describe('resolveCheckButtonIconKey (check_button.cpp:105-127)', () => {
  it('unchecked, not disabled -> unchecked', () => {
    expect(resolveCheckButtonIconKey({} as CheckButtonProperties, false)).toBe('unchecked');
  });

  it('checked, not disabled -> checked', () => {
    expect(resolveCheckButtonIconKey({ buttonPressed: true } as CheckButtonProperties, false)).toBe(
      'checked'
    );
  });

  it('unchecked, disabled -> uncheckedDisabled', () => {
    expect(resolveCheckButtonIconKey({ disabled: true } as CheckButtonProperties, false)).toBe(
      'uncheckedDisabled'
    );
  });

  it('checked, disabled -> checkedDisabled (disabled wins over checked for the icon variant)', () => {
    expect(
      resolveCheckButtonIconKey({ buttonPressed: true, disabled: true } as CheckButtonProperties, false)
    ).toBe('checkedDisabled');
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
    const props: CheckButtonProperties = controlProps({
      name: 'CB',
      textDirection: 0,
      language: '',
      buttonPressed: true,
    });
    expect(checkButtonIconColor(props, { button_checked_color: { r: 0, g: 1, b: 0, a: 1 } })).toEqual({
      r: 0,
      g: 1,
      b: 0,
      a: 1,
    });
  });
});

describe('checkButtonContentFacts margins (default_theme.cpp:317)', () => {
  const margin = (theme: SolveContext['theme']) =>
    checkButtonContentFacts(node({}), {}, { theme }, { x: 100, y: 40 }, null).styleMargin;

  it('marginY equals theme.contentMargin (round(4*scale))', () => {
    expect(margin(ctx().theme)).toMatchObject({ top: 4, bottom: 4 });
  });

  it('marginX is round(6*scale)', () => {
    expect(margin(ctx().theme)).toMatchObject({ left: 6, right: 6 });
  });

  it('marginX moves with a non-1 theme scale (default_theme.cpp:317: round(6*scale))', () => {
    expect(margin(nativeTheme(1.5))).toMatchObject({ left: 9, right: 9 });
  });
});

describe('checkButtonMinimumSize (check_button.cpp:64-79): no text', () => {
  it('is 2*marginX(6) + icon(32x16) width, 2*marginY(4) + icon height — (44, 24)', () => {
    expect(checkButtonMinimumSize(node({}), ctx())).toEqual({ x: 44, y: 24 });
  });

  it('widens on a themed "unchecked" icon — check_button.cpp:35-62 maxes the CURRENT (non-disabled) pair', () => {
    const n = { ...node({}), textureSlots: { unchecked: { x: 40, y: 20 } } };
    // width = 2*6 + max(checked=32 default, unchecked=40) = 52; height = 2*4 + 20 = 28.
    expect(checkButtonMinimumSize(n, ctx())).toEqual({ x: 52, y: 28 });
  });

  it('ignores a themed "unchecked" (enabled) icon while disabled — only the _disabled pair counts', () => {
    const n = { ...node({ disabled: true }), textureSlots: { unchecked: { x: 40, y: 20 } } };
    expect(checkButtonMinimumSize(n, ctx())).toEqual({ x: 44, y: 24 });
  });
});

describe('checkButtonMinimumSize: with text', () => {
  it('adds text width + h_separation(4) alongside the icon width; height floors on the taller of text/icon', () => {
    const result = checkButtonMinimumSize(node({ text: 'AB' }), ctx());
    // width = 12 (2*marginX) + 22 (shaped text) + 4 (h_separation) + 32 (icon) = 70.
    expect(result.x).toBe(12 + AB_SHAPED_WIDTH + 4 + 32);
    // height = 8 (2*marginY) + max(23, 16) = 31.
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('treats an absent measurer as "text contributes nothing" — icon-only floor still returns', () => {
    expect(checkButtonMinimumSize(node({ text: 'AB' }), ctx(false))).toEqual({ x: 44, y: 24 });
  });

  it('h_separation theme_override_constants wins over the theme default', () => {
    const result = checkButtonMinimumSize(
      node({ text: 'AB', themeOverrideConstants: { h_separation: 10 } }),
      ctx()
    );
    expect(result.x).toBe(12 + AB_SHAPED_WIDTH + 10 + 32);
  });

  it('icon_max_width theme_override_constants clamps the (32x16) icon before it contributes', () => {
    const result = checkButtonMinimumSize(
      node({ text: 'AB', themeOverrideConstants: { icon_max_width: 8 } }),
      ctx()
    );
    // fitIconSize(32x16, 8) = (8, 4).
    expect(result.x).toBe(12 + AB_SHAPED_WIDTH + 4 + 8);
    expect(result.y).toBe(8 + FONT_HEIGHT); // 4 < 23, text still floors height
  });
});

/**
 * What `layoutButtonContent` reads of a 150x28 CheckButton: `cb_empty`'s margins (6 across, 4 down), the
 * label 26 px high, and the vendored 32x16 toggle, which `layoutCheckButtonContent` reserves as the internal margin.
 */
const CONTENT: ButtonContentFacts & Pick<ButtonContentInput, 'textNaturalSize' | 'isTextRtl'> = {
  rectSize: { x: 150, y: 28 },
  styleMargin: { left: 6, top: 4, right: 6, bottom: 4 },
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
function layoutWithCheck(input: Parameters<typeof layoutCheckButtonContent>[0]) {
  const { content, checkSize } = input;
  const internalMargin = internalMarginAt(content.rtl ? 'left' : 'right', checkSize.x);
  return layoutCheckButtonContent({ ...input, content: { ...content, internalMargin } });
}

const BASE = { content: CONTENT, checkSize: { x: 32, y: 16 }, checkVOffset: 0 };
const WITH_BUTTON_ICON = { ...CONTENT, iconNaturalSize: { x: 12, y: 12 } };

describe('layoutCheckButtonContent (check_button.cpp:126-133 + button.cpp:247-260,444-456)', () => {
  it('ends an overflowing right-to-left CENTER label at the trailing edge (text_paragraph.cpp:908-910)', () => {
    // The text box is 150 - 2*6 - (32+4) = 102 wide: 6 + (102 - 200) = -92.
    const { labelBox } = layoutWithCheck({ ...BASE, content: { ...CONTENT, textAlignment: 1 } });
    const rtlLine = { text: '', glyphs: [], widthPx: 200, paragraphIndex: 0, paragraphStart: 0, isRtl: true };
    const [drawn] = buttonDrawnLabel([rtlLine], labelBox!.widthPx, labelBox!.alignment);
    expect(labelBox!.leftPx + drawn!.offsetXPx).toBe(-92);
  });

  it('toggle sits flush against the RIGHT edge, vertically centred + check_v_offset', () => {
    const { checkPosition } = layoutWithCheck(BASE);
    // x = 150 - (32+6) = 112. y = (28-16)/2 + 0 = 6.
    expect(checkPosition).toEqual({ x: 112, y: 6 });
  });

  it('centres the toggle at the half pixel an odd height leaves, unrounded (check_button.cpp:140)', () => {
    const tall = { ...CONTENT, rectSize: { x: 150, y: 31 } };
    expect(layoutWithCheck({ ...BASE, content: tall }).checkPosition.y).toBe(7.5);
  });

  it('the label box starts at marginX and ends before the toggle and its h_separation', () => {
    const { labelBox } = layoutWithCheck(BASE);
    // width = 150 - 12 - (32 + 4) = 102. customElementHeight = 28-8=20; topPx = floor((20-26)/2 + 4) = 1.
    expect(labelBox).toEqual({ leftPx: 6, topPx: 1, widthPx: 102, alignment: 0 });
  });

  it('hands the authored alignment to the drawn label', () => {
    expect(layoutWithCheck({ ...BASE, content: { ...CONTENT, textAlignment: 1 } }).labelBox!.alignment).toBe(
      1
    );
    expect(layoutWithCheck({ ...BASE, content: { ...CONTENT, textAlignment: 2 } }).labelBox!.alignment).toBe(
      2
    );
  });

  it('keeps the unceiled drawable width: the ceiling belongs to the drawn label (button.cpp:437)', () => {
    const wide = { ...CONTENT, rectSize: { x: 150.5, y: 28 } };
    expect(layoutWithCheck({ ...BASE, content: wide }).labelBox!.widthPx).toBe(102.5);
  });

  it('returns labelBox: null when hasText is false (toggle still positioned)', () => {
    const { checkPosition, labelBox } = layoutWithCheck({
      ...BASE,
      content: { ...CONTENT, hasText: false },
    });
    expect(labelBox).toBeNull();
    expect(checkPosition).toEqual({ x: 112, y: 6 });
  });

  it('check_v_offset shifts the toggle vertically', () => {
    const { checkPosition } = layoutWithCheck({ ...BASE, checkVOffset: 3 });
    expect(checkPosition.y).toBe(9);
  });

  it('draws no Button icon without one', () => {
    expect(layoutWithCheck(BASE).icon).toBeNull();
  });

  it("draws Button's LEFT icon at the left margin, the toggle being on the right (button.cpp:374-381,411-423)", () => {
    const { icon, labelBox } = layoutWithCheck({ ...BASE, content: WITH_BUTTON_ICON });
    // x = margin 6; y = floor(4 + (20 - 12) / 2) = 8. The label starts at 6 + (12 + 4) = 22, 102 - 16 = 86 wide.
    expect(icon).toEqual({ rect: { x: 6, y: 8, w: 12, h: 12 } });
    expect(labelBox).toMatchObject({ leftPx: 22, widthPx: 86 });
  });

  it("draws Button's RIGHT icon before the toggle and its separation (button.cpp:385-387)", () => {
    const { icon, labelBox } = layoutWithCheck({
      ...BASE,
      content: { ...WITH_BUTTON_ICON, iconAlignment: 2 },
    });
    // x = 150 - 6 - (32 + 4) - 12 = 96.
    expect(icon!.rect.x).toBe(96);
    expect(labelBox).toMatchObject({ leftPx: 6, widthPx: 86 });
  });

  it("centres Button's CENTER icon in the box the toggle leaves (button.cpp:374-381)", () => {
    const { icon, labelBox } = layoutWithCheck({
      ...BASE,
      content: { ...WITH_BUTTON_ICON, iconAlignment: 1 },
    });
    // x = 6 + (102 - 12) / 2 = 51; the label box keeps its whole width.
    expect(icon!.rect.x).toBe(51);
    expect(labelBox).toMatchObject({ leftPx: 6, widthPx: 102 });
  });
});

/**
 * The RTL arms: the toggle sits at `margin(SIDE_LEFT)` (check_button.cpp:135), the internal margin
 * reserves SIDE_LEFT (`:98-104`), and the constructor's LEFT alignment (`:174`) becomes RIGHT
 * through `Button::_notification`'s swap (`button.cpp:271-275`).
 */
describe('layoutCheckButtonContent: RTL puts the toggle on the left', () => {
  const RTL = { ...BASE, content: { ...CONTENT, rtl: true } };

  it('draws the toggle at the left content margin, vertically unchanged', () => {
    const { checkPosition } = layoutWithCheck(RTL);
    expect(checkPosition).toEqual({ x: 6, y: 6 });
  });

  it('puts the label box right of the toggle and aligns a LEFT label RIGHT', () => {
    const { labelBox } = layoutWithCheck(RTL);
    // reserved = 32+4 = 36; drawable = 150-12-36 = 102.
    expect(labelBox).toEqual({ leftPx: 6 + 36, topPx: 1, widthPx: 102, alignment: 2 });
  });

  it('leaves CENTER alone and swaps RIGHT to LEFT', () => {
    expect(
      layoutWithCheck({ ...RTL, content: { ...RTL.content, textAlignment: 1 } }).labelBox!.alignment
    ).toBe(1);
    expect(
      layoutWithCheck({ ...RTL, content: { ...RTL.content, textAlignment: 2 } }).labelBox!.alignment
    ).toBe(0);
  });

  it("draws Button's LEFT icon at the right margin under RTL (button.cpp:262-276,385-387)", () => {
    const { icon } = layoutWithCheck({ ...RTL, content: { ...WITH_BUTTON_ICON, rtl: true } });
    // The icon's side swaps to RIGHT, and the toggle is on the left: x = 150 - 6 - 12 = 132.
    expect(icon!.rect.x).toBe(132);
  });
});

describe("checkButtonMinimumSize: Button's inherited icon (check_button.cpp:64-79, button.cpp:481-526)", () => {
  const withIcon = (props: Partial<CheckButtonProperties>, size = { x: 12, y: 12 }): SolveNode => ({
    ...node(props),
    textureSlots: { icon: size },
  });

  it('adds the icon and a separation between it and the toggle, though there is no text', () => {
    // content = 12; the toggle adds h_separation 4 (the content is wider than 0) and 32: 12 + 12 + 4 + 32.
    expect(checkButtonMinimumSize(withIcon({}), ctx())).toEqual({ x: 60, y: 8 + 16 });
  });

  it('adds the icon, its separation to the text, and the toggle', () => {
    const result = checkButtonMinimumSize(withIcon({ text: 'AB' }), ctx());
    // 12 + (22 + 4 + 12) + 4 + 32.
    expect(result).toEqual({ x: 12 + AB_SHAPED_WIDTH + 4 + 12 + 4 + 32, y: 8 + FONT_HEIGHT });
  });

  it('stacks the icon above the text for a TOP icon, and adds the font height again (button.cpp:497-502,517-521)', () => {
    const result = checkButtonMinimumSize(withIcon({ text: 'AB', verticalIconAlignment: 0 }), ctx());
    expect(result.y).toBe(8 + FONT_HEIGHT + 12 + FONT_HEIGHT);
  });

  it('adds no icon for expand_icon (button.cpp:497)', () => {
    expect(checkButtonMinimumSize(withIcon({ expandIcon: true }), ctx())).toEqual(
      checkButtonMinimumSize(node({}), ctx())
    );
  });

  it('takes the icon and the toggle off the width a wrapping label shapes at (button.cpp:428-432)', () => {
    // Wraps at 100 - 12 - 36 = 52 for the toggle alone: 'AB AB' is 46.6 px, one row. With a 12 px icon it
    // is 52 - 16 = 36 px: two rows.
    const tentative: SolveContext = { ...ctx(), tentativeRect: () => ({ x: 0, y: 0, w: 100, h: 60 }) };
    const props = { text: 'AB AB', autowrapMode: 2 };
    expect(checkButtonMinimumSize(node(props), tentative).y).toBe(8 + FONT_HEIGHT);
    expect(checkButtonMinimumSize(withIcon(props), tentative).y).toBe(8 + 2 * FONT_HEIGHT);
  });
});

describe("checkButtonTextureSlots: Button's own icon property", () => {
  const nodeWithIcon = (icon?: string) =>
    controlNode('CB', 'CheckButton', { name: 'CB', ...(icon ? { icon } : {}) });

  it('requests the icon ref first, so `textureSize` is the icon, as it is for a Button', () => {
    expect(checkButtonTextureSlots(nodeWithIcon('ExtResource("1")'), {})).toEqual([
      { key: 'icon', ref: 'ExtResource("1")' },
    ]);
  });

  it('requests nothing for no icon', () => {
    expect(checkButtonTextureSlots(nodeWithIcon(), {})).toEqual([]);
  });
});

/**
 * `_notification` and `get_icon_size` both read the `*_mirrored` icons under RTL
 * (`check_button.cpp:39-46`, `:109-120`): separate Theme entries the default theme fills with
 * the `toggle_*_mirrored` SVGs (`default_theme.cpp:332-335`), not a flip of the plain ones.
 */
describe('resolveCheckButtonIconKey: RTL selects the mirrored variant', () => {
  it('picks the mirrored twin of whichever state is showing', () => {
    expect(resolveCheckButtonIconKey({} as CheckButtonProperties, true)).toBe('uncheckedMirrored');
    expect(resolveCheckButtonIconKey({ buttonPressed: true } as CheckButtonProperties, true)).toBe(
      'checkedMirrored'
    );
    expect(resolveCheckButtonIconKey({ disabled: true } as CheckButtonProperties, true)).toBe(
      'uncheckedDisabledMirrored'
    );
    expect(
      resolveCheckButtonIconKey({ buttonPressed: true, disabled: true } as CheckButtonProperties, true)
    ).toBe('checkedDisabledMirrored');
  });

  it('keeps the plain variants under LTR', () => {
    expect(resolveCheckButtonIconKey({} as CheckButtonProperties, false)).toBe('unchecked');
  });
});

describe('checkButtonMinimumSize: RTL sizes off the mirrored icon pair', () => {
  it('widens on a themed unchecked_mirrored, and ignores it under LTR', () => {
    const slots = { textureSlots: { unchecked_mirrored: { x: 40, y: 20 } } };
    expect(checkButtonMinimumSize({ ...node({}), ...slots, rtl: true }, ctx())).toEqual({ x: 52, y: 28 });
    expect(checkButtonMinimumSize({ ...node({}), ...slots, rtl: false }, ctx())).toEqual({ x: 44, y: 24 });
  });

  it('ignores a themed plain unchecked under RTL', () => {
    const slots = { textureSlots: { unchecked: { x: 40, y: 20 } } };
    expect(checkButtonMinimumSize({ ...node({}), ...slots, rtl: true }, ctx())).toEqual({ x: 44, y: 24 });
  });
});

/** Godot draws the current icon at its own fitted size, placed by the larger (`check_button.cpp:133-145`). */
describe('checkButtonDrawnIconSize', () => {
  it("is the current icon's own size, not the larger icon's", () => {
    const n = { textureSlots: { checked: { x: 64, y: 40 } }, constants: {} };
    expect(checkButtonDrawnIconSize(n, 'unchecked')).toEqual(
      checkButtonDrawnIconSize({ textureSlots: {}, constants: {} }, 'unchecked')
    );
  });

  it('is 0 for an icon that reports size 0, as an unset ViewportTexture does', () => {
    const n = { textureSlots: { unchecked: { x: 0, y: 0 } }, constants: {} };
    expect(checkButtonDrawnIconSize(n, 'unchecked')).toEqual({ x: 0, y: 0 });
  });
});

describe('checkButtonMinimumSize: clip_text zeroes the text width (button.cpp:493-495)', () => {
  it('keeps the icon, the margins and the text height, and drops the text width and the h_separation', () => {
    const result = checkButtonMinimumSize(node({ text: 'AB', clipText: true }), ctx());
    expect(result).toEqual({ x: 12 + 32, y: 8 + FONT_HEIGHT });
  });

  it('keeps the whole text width without clip_text', () => {
    const result = checkButtonMinimumSize(node({ text: 'AB', clipText: false }), ctx());
    expect(result.x).toBe(12 + AB_SHAPED_WIDTH + 4 + 32);
  });
});

describe('checkButtonMinimumSize: a trimming text_overrun_behavior zeroes the text width (button.cpp:493-495)', () => {
  it('drops the text width and the h_separation under OVERRUN_TRIM_ELLIPSIS', () => {
    const result = checkButtonMinimumSize(node({ text: 'AB', overrunBehavior: 3 }), ctx());
    expect(result).toEqual({ x: 12 + 32, y: 8 + FONT_HEIGHT });
  });

  it('keeps the whole text width under OVERRUN_NO_TRIMMING', () => {
    const result = checkButtonMinimumSize(node({ text: 'AB', overrunBehavior: 0 }), ctx());
    expect(result.x).toBe(12 + AB_SHAPED_WIDTH + 4 + 32);
  });
});

describe('checkButtonMinimumSize: autowrap_mode wraps the label at the tentative width (button.cpp:429-432,493-495)', () => {
  const text = 'alpha bravo charlie';

  function minSize(props: Partial<CheckButtonProperties>, tentativeWidthPx?: number) {
    const context: SolveContext = {
      ...ctx(),
      ...(tentativeWidthPx === undefined
        ? {}
        : { tentativeRect: () => ({ x: 0, y: 0, w: tentativeWidthPx, h: 40 }) }),
    };
    return checkButtonMinimumSize(node(props), context);
  }

  it('drops the text width and the h_separation, keeping the margins and the toggle', () => {
    expect(minSize({ text, autowrapMode: 2 }).x).toBe(12 + 32);
  });

  it('grows to one font height per wrapped row at a narrow tentative width', () => {
    expect(minSize({ text, autowrapMode: 2 }, 100).y).toBe(8 + 3 * FONT_HEIGHT);
  });

  it('stays one row high until a tentative width is known', () => {
    expect(minSize({ text, autowrapMode: 2 }).y).toBe(8 + FONT_HEIGHT);
  });

  it('never wraps at AUTOWRAP_OFF, whatever the tentative width says', () => {
    expect(minSize({ text }, 100).y).toBe(8 + FONT_HEIGHT);
  });
});
