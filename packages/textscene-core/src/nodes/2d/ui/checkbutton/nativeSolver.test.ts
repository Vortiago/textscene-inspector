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
  checkButtonMinimumSize,
  checkButtonToggleRect,
  resolveCheckButtonIconKey,
  checkButtonIconColor,
  checkButtonTextureSlots,
} from './nativeSolver';
import {
  controlNode,
  projectFontsAt,
  solveNode,
  withThemeItems,
} from '../../../../r3f/controls/native/testing/solveNode';
import { drawnStyleBox } from '../../../../r3f/controls/native/testing/drawnStyleBox';

const AB_WIDTH = (1354 + 1350) * (16 / 2048); // 21.125
const AB_SHAPED_WIDTH = Math.ceil(AB_WIDTH); // 22
const FONT_HEIGHT = 23;

/** `fields` stand in for what the tree build gives the node before the default theme fills it. */
function node(props: Partial<CheckButtonProperties>, fields: Partial<SolveNode> = {}): SolveNode {
  return withThemeItems({
    ...solveNode(),
    path: 'CB',
    node: controlNode('CB', 'CheckButton', { name: 'CB', ...props }),
    // A local theme_override_colors/* reaches `resolveTextTheme` through
    // `n.colors`, which the walker folds in, not through props.
    colors: props.themeOverrideColors ?? {},
    constants: props.themeOverrideConstants ?? {},
    ...fields,
  });
}

function ctx(withMeasurer = true): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: withMeasurer ? measureText : null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

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
    expect(checkButtonIconColor({} as CheckButtonProperties, node({}).colors)).toEqual({
      r: 1,
      g: 1,
      b: 1,
      a: 1,
    });
  });

  it('is opaque white when checked (a DIFFERENT theme key, same default literal)', () => {
    expect(checkButtonIconColor({ buttonPressed: true } as CheckButtonProperties, node({}).colors)).toEqual({
      r: 1,
      g: 1,
      b: 1,
      a: 1,
    });
  });

  it('a theme_override_colors/button_checked_color override (already folded into n.colors) wins when checked', () => {
    const props = { buttonPressed: true } as CheckButtonProperties;
    expect(checkButtonIconColor(props, { button_checked_color: { r: 0, g: 1, b: 0, a: 1 } })).toEqual({
      r: 0,
      g: 1,
      b: 0,
      a: 1,
    });
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

const RECT_SIZE = { x: 150, y: 28 };
const THEME = nativeTheme(1);

describe('checkButtonToggleRect (check_button.cpp:129-145)', () => {
  it('puts the toggle short of the right margin, vertically centred', () => {
    // x = 150 - (32 + 6). y = (28 - 16) / 2.
    expect(checkButtonToggleRect(node({}), THEME, 'unchecked', RECT_SIZE)).toEqual({
      x: 112,
      y: 6,
      w: 32,
      h: 16,
    });
  });

  it('centres the toggle at the half pixel an odd height leaves, unrounded (check_button.cpp:140)', () => {
    expect(checkButtonToggleRect(node({}), THEME, 'unchecked', { x: 150, y: 31 }).y).toBe(7.5);
  });

  it('adds check_v_offset', () => {
    const n = node({ themeOverrideConstants: { check_v_offset: 3 } });
    expect(checkButtonToggleRect(n, THEME, 'unchecked', RECT_SIZE).y).toBe(9);
  });

  it('puts the toggle at the left margin under RTL (check_button.cpp:135-136)', () => {
    const rtl = { ...node({}), rtl: true };
    expect(checkButtonToggleRect(rtl, THEME, 'uncheckedMirrored', RECT_SIZE)).toMatchObject({ x: 6, y: 6 });
  });

  it('scales the default margin with the theme: round(6 * scale) (default_theme.cpp:317)', () => {
    // x = 150 - (48 + 9): the toggle is rasterised at the theme scale too.
    expect(
      checkButtonToggleRect(
        node({}, { projectFonts: projectFontsAt(1.5) }),
        nativeTheme(1.5),
        'unchecked',
        RECT_SIZE
      ).x
    ).toBe(93);
  });

  it('draws the vendored toggle at its authored size times the theme scale (default_theme.cpp:82-84)', () => {
    expect(checkButtonToggleRect(node({}), nativeTheme(1.5), 'unchecked', RECT_SIZE)).toMatchObject({
      w: 48,
      h: 24,
    });
  });

  it("reads the margin from the node's `normal` box, whatever the draw state", () => {
    const normal = drawnStyleBox({ content_margin_left: '20', content_margin_right: '30' });
    const pressed = drawnStyleBox({ content_margin_left: '1', content_margin_right: '1' });
    const n = node({ buttonPressed: true }, { styleBoxes: { normal, pressed } });
    expect(checkButtonToggleRect(n, THEME, 'checked', RECT_SIZE).x).toBe(150 - (32 + 30));
    expect(checkButtonToggleRect({ ...n, rtl: true }, THEME, 'checkedMirrored', RECT_SIZE).x).toBe(20);
  });

  it('draws the current icon at its own size, at the offset the larger icon sets (check_button.cpp:133-145)', () => {
    const n = { ...node({}), textureSlots: { checked: { x: 64, y: 40 } } };
    // The larger icon is 64 by 40: x = 150 - (64 + 6), y = (28 - 40) / 2. The unchecked icon keeps its size.
    expect(checkButtonToggleRect(n, THEME, 'unchecked', RECT_SIZE)).toEqual({ x: 80, y: -6, w: 32, h: 16 });
  });

  it('draws nothing for an icon that reports size 0, as an unset ViewportTexture does', () => {
    const n = { ...node({}), textureSlots: { unchecked: { x: 0, y: 0 } } };
    expect(checkButtonToggleRect(n, THEME, 'unchecked', RECT_SIZE)).toMatchObject({ w: 0, h: 0 });
  });
});

describe('checkButtonMinimumSize: the boxes of the draw states (check_button.cpp:68-83, button.cpp:55-95)', () => {
  it('keeps the default `hover_pressed` box in the largest padding where every state box has no margin (default_theme.cpp:324)', () => {
    const none = drawnStyleBox({});
    const styleBoxes = { normal: none, pressed: none, hover: none, disabled: none };
    // Measured in Godot 4.6.3: the content is max(0 - 8, 16) inside the padding 8, and 0 - 12 + 32 across.
    expect(checkButtonMinimumSize(node({}, { styleBoxes }), ctx())).toEqual({ x: 32, y: 24 });
  });
});

describe("checkButtonMinimumSize: Button's inherited icon (check_button.cpp:64-79, button.cpp:481-526)", () => {
  const withIcon = (props: Partial<CheckButtonProperties>, size = { x: 12, y: 12 }): SolveNode => ({
    ...node(props),
    textureSize: size,
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

  it('keeps the icon slot first without an icon, so `textureSize` is never a themed toggle icon', () => {
    const themed = {
      checked: { ref: 'ExtResource("2")', resources: solveNode().resources, isHeldLocally: true },
    };
    expect(checkButtonTextureSlots(nodeWithIcon(), themed).map((request) => request.key)).toEqual([
      'icon',
      'checked',
    ]);
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

describe('checkButtonMinimumSize at a theme scale (check_button.cpp:68-83)', () => {
  const at15: SolveContext = { ...ctx(), theme: nativeTheme(1.5) };

  it('reserves the toggle at its scaled size: the same minimum as a themed 48x24 toggle', () => {
    const themed = { ...node({}), textureSlots: { unchecked: { x: 48, y: 24 } } };

    expect(checkButtonMinimumSize(node({}), at15)).toEqual(checkButtonMinimumSize(themed, at15));
    expect(checkButtonMinimumSize(node({}), at15).x).toBeGreaterThan(48);
  });
});
