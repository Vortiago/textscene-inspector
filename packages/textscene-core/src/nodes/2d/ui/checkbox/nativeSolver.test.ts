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
  checkBoxCheckColor,
  checkBoxCheckRect,
  checkBoxMinimumSize,
  resolveCheckBoxIconKey,
  checkBoxTextureSlots,
} from './nativeSolver';
import { BUTTON_THEME_FONT_KEY } from '../button/nativeSolver';
import { controlNode, solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { drawnStyleBox } from '../../../../r3f/controls/native/testing/drawnStyleBox';

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

describe('checkBoxMinimumSize: a themed icon widens the minimum size (check_box.cpp:64-79)', () => {
  it("floors the width on the themed icon's own size, not the vendored 16x16", () => {
    const n = { ...node({}), textureSlots: { unchecked: { x: 24, y: 24 } } };
    // No text: content_size is the icon alone (check_box.cpp:66-79), then
    // `_get_largest_stylebox_size()` (cbx_empty's uniform content margin,
    // 4px at scale 1) is added back on every side: 24 + 2*4 = 32.
    expect(checkBoxMinimumSize(n, ctx())).toEqual({ x: 32, y: 32 });
  });

  it('widens to a themed "checked" icon while the CheckBox draws "unchecked" (check_box.cpp:35-62)', () => {
    const n = { ...node({}), textureSlots: { checked: { x: 24, y: 24 } } };
    expect(checkBoxMinimumSize(n, ctx())).toEqual({ x: 32, y: 32 });
  });

  it('keeps the 16x16 of the seven default icons when one themed icon is smaller', () => {
    const n = { ...node({}), textureSlots: { checked: { x: 8, y: 8 } } };
    expect(checkBoxMinimumSize(n, ctx())).toEqual({ x: 24, y: 24 });
  });
});

const RECT_SIZE = { x: 150, y: 28 };
const THEME = nativeTheme(1);

describe('checkBoxCheckRect (check_box.cpp:126-142)', () => {
  it('puts the check at the left margin, vertically centred', () => {
    // y = int((28 - 16) / 2) = 6.
    expect(checkBoxCheckRect(node({}), THEME, 'unchecked', RECT_SIZE)).toEqual({ x: 4, y: 6, w: 16, h: 16 });
  });

  it('truncates the centring before it adds check_v_offset (check_box.cpp:131)', () => {
    const n = node({ themeOverrideConstants: { check_v_offset: 3 } });
    // int((27 - 16) / 2) = 5, then + 3.
    expect(checkBoxCheckRect(n, THEME, 'unchecked', { x: 150, y: 27 }).y).toBe(8);
  });

  it('puts the check short of the right margin under RTL (check_box.cpp:129)', () => {
    // x = 150 - 4 - 16.
    expect(checkBoxCheckRect({ ...node({}), rtl: true }, THEME, 'unchecked', RECT_SIZE).x).toBe(130);
  });

  it("reads the margin from the node's `normal` box, whatever the draw state", () => {
    const normal = drawnStyleBox({ content_margin_left: '20', content_margin_right: '30' });
    const pressed = drawnStyleBox({ content_margin_left: '1', content_margin_right: '1' });
    const n = { ...node({ buttonPressed: true }), styleBoxes: { normal, pressed } };
    expect(checkBoxCheckRect(n, THEME, 'checked', RECT_SIZE).x).toBe(20);
    expect(checkBoxCheckRect({ ...n, rtl: true }, THEME, 'checked', RECT_SIZE).x).toBe(150 - 30 - 16);
  });

  it('draws the current icon at its own size, at the offset the largest icon sets (check_box.cpp:137-142)', () => {
    const n = { ...node({}), textureSlots: { checked: { x: 32, y: 32 } } };
    // The largest icon is 32 px: y = int((28 - 32) / 2) = -2. The unchecked icon keeps its 16 px.
    expect(checkBoxCheckRect(n, THEME, 'unchecked', RECT_SIZE)).toEqual({ x: 4, y: -2, w: 16, h: 16 });
  });

  it('draws nothing for an icon that reports size 0, as an unset ViewportTexture does', () => {
    const n = { ...node({}), textureSlots: { unchecked: { x: 0, y: 0 } } };
    expect(checkBoxCheckRect(n, THEME, 'unchecked', RECT_SIZE)).toMatchObject({ w: 0, h: 0 });
  });
});

describe('checkBoxCheckColor (check_box.cpp:139-142)', () => {
  const RED = { r: 1, g: 0, b: 0, a: 1 };
  const colors = { checkbox_checked_color: RED };

  it('is white by default (default_theme.cpp:312-313)', () => {
    expect(checkBoxCheckColor({ buttonPressed: true } as CheckBoxProperties, {})).toEqual({
      r: 1,
      g: 1,
      b: 1,
      a: 1,
    });
  });

  it('reads checkbox_checked_color for a checked box only', () => {
    expect(checkBoxCheckColor({ buttonPressed: true } as CheckBoxProperties, colors)).toEqual(RED);
    expect(checkBoxCheckColor({} as CheckBoxProperties, colors)).toEqual({ r: 1, g: 1, b: 1, a: 1 });
  });
});

describe('checkBoxMinimumSize: the boxes of the draw states (check_box.cpp:64-79, button.cpp:52-95,525)', () => {
  it("adds the current state's `normal` box margins, not the default theme's", () => {
    const normal = drawnStyleBox({
      content_margin_left: '10',
      content_margin_right: '10',
      content_margin_top: '2',
      content_margin_bottom: '2',
    });
    // 20 + check 16 across. Down, the content is max(0 + 4 - 8, 16) inside the largest padding 8.
    expect(checkBoxMinimumSize({ ...node({}), styleBoxes: { normal } }, ctx())).toEqual({ x: 36, y: 24 });
  });

  it('lays out in the largest margins of every state under align_to_largest_stylebox', () => {
    const pressed = drawnStyleBox({ content_margin_left: '30', content_margin_right: '30' });
    const n = {
      ...node({ themeOverrideConstants: { align_to_largest_stylebox: 1 } }),
      styleBoxes: { pressed },
    };
    // The unpressed box takes the pressed box's 60 px across.
    expect(checkBoxMinimumSize(n, ctx()).x).toBe(60 + 16);
  });
});

describe("checkBoxMinimumSize: Button's inherited icon (check_box.cpp:64-79, button.cpp:481-526)", () => {
  const withIcon = (props: Partial<CheckBoxProperties>, size = { x: 12, y: 12 }): SolveNode => ({
    ...node(props),
    textureSize: size,
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

  it('keeps the icon slot first without an icon, so `textureSize` is never a themed check icon', () => {
    const themed = {
      checked: { ref: 'ExtResource("2")', resources: solveNode().resources, isHeldLocally: true },
    };
    expect(checkBoxTextureSlots(nodeWithIcon(), themed).map((request) => request.key)).toEqual([
      'icon',
      'checked',
    ]);
  });
});

describe(`checkBoxMinimumSize: resolves this CheckBox's own theme font key ("${BUTTON_THEME_FONT_KEY}", default_theme.cpp:297)`, () => {
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
      fontOverrides: { [BUTTON_THEME_FONT_KEY]: unresolvableFont },
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
    const n: SolveNode = { ...node({}), fontOverrides: { [BUTTON_THEME_FONT_KEY]: unresolvableFont } };
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
