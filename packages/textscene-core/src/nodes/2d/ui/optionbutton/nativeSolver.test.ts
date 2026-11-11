/**
 * Tests `optionbutton/nativeSolver.ts` against Godot 4.6.3 (`scene/gui/option_button.cpp`,
 * `scene/theme/default_theme.cpp:212-251`) with numbers derived by hand from OpenSans_SemiBold's `hmtx`
 * advances, never from the code: font height 23, 'A' 10.578125. `textOffset` is the box top-left, and
 * `<TextRun>` reconciles the MSDF line anchor (`TextRun.test.tsx`).
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fontFile } from '../../../../r3f/controls/native/text/sfntOutlines.testkit';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import * as logger from '../../../../logger';
import type { OptionButtonProperties } from './types';
import {
  OPTION_BUTTON_CLASS,
  optionButtonArrowColor,
  optionButtonArrowRect,
  optionButtonMinimumSize,
  optionButtonTextureSlots,
} from './nativeSolver';
import { BUTTON_THEME_FONT_KEY } from '../button/nativeSolver';
import { controlNode, solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { drawnStyleBox } from '../../../../r3f/controls/native/testing/drawnStyleBox';

const A_ADVANCE = 1354 * (16 / 2048); // 10.578125
// 'B' is 1350 design units, not 'A''s 1354.
const AB_WIDTH = (1354 + 1350) * (16 / 2048); // 21.125
// `TS->shaped_text_get_size(...).x` ceils the pen advance (`text_server_adv.cpp:7524-7537`), and every
// minimum size below builds on that, not on the fractional sum.
const AB_SHAPED_WIDTH = Math.ceil(AB_WIDTH); // 22
const FONT_HEIGHT = 23;

function node(props: Partial<OptionButtonProperties>): SolveNode {
  return {
    ...solveNode(),
    path: 'O',
    node: controlNode('O', 'OptionButton', { name: 'O', ...props }),
    // A local theme_override_colors/* or constants/* reaches a solver through `n.colors` or `n.constants`,
    // which the walker fills unconditionally, not through props.
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

describe('optionButtonTextureSlots', () => {
  const themed = { ref: 'ExtResource("1")', resources: solveNode().resources, isHeldLocally: true };

  it("requests Button's icon slot first, then a themed arrow, so `textureSize` is never the arrow", () => {
    const requests = optionButtonTextureSlots(controlNode('Opt', 'OptionButton'), { arrow: themed });
    expect(requests.map(({ key }) => key)).toEqual(['icon', 'arrow']);
  });

  it('requests no arrow when none is themed', () => {
    const requests = optionButtonTextureSlots(controlNode('Opt', 'OptionButton'), {});
    expect(requests.map(({ key }) => key)).toEqual(['icon']);
  });
});

describe("optionButtonTextureSlots: items' icons (option_button.cpp:424,451)", () => {
  const items = [
    { text: 'A', id: 0, icon: 'ExtResource("1")' },
    { text: 'B', id: 1, icon: 'ExtResource("2")' },
    { text: 'C', id: 2 },
  ];
  const slots = (props: Partial<OptionButtonProperties>) =>
    optionButtonTextureSlots(controlNode('Opt', 'OptionButton', { name: 'Opt', ...props }), {});

  it("requests the selected item's icon as Button's icon, first, and every item's own icon after it", () => {
    const requests = slots({ items, selected: 1 });
    expect(requests.map(({ key, ref }) => [key, ref])).toEqual([
      ['icon', 'ExtResource("2")'],
      ['popup/item_0/icon', 'ExtResource("1")'],
      ['popup/item_1/icon', 'ExtResource("2")'],
    ]);
  });

  it("requests Button's icon slot with no reference when nothing is selected, and each item's icon after it", () => {
    expect(slots({ items }).map(({ key, ref }) => [key, ref])).toEqual([
      ['icon', ''],
      ['popup/item_0/icon', 'ExtResource("1")'],
      ['popup/item_1/icon', 'ExtResource("2")'],
    ]);
  });

  it("requests Button's icon slot with no reference for a selected item without an icon", () => {
    expect(slots({ items, selected: 2 }).map(({ key, ref }) => [key, ref])[0]).toEqual(['icon', '']);
  });
});

describe('theme.widgets.optionButton', () => {
  it('uses 8px horizontal / 4px vertical content margins (2*default_margin / default_margin), identical for normal+disabled', () => {
    const boxes = nativeTheme(1).widgets.optionButton;
    expect(boxes.normal.contentMargin).toEqual({ left: 8, top: 4, right: 8, bottom: 4 });
    expect(boxes.disabled.contentMargin).toEqual({ left: 8, top: 4, right: 8, bottom: 4 });
  });

  it('normal fill is style_normal_color (0.1,0.1,0.1,0.6); disabled is style_disabled_color (0.1,0.1,0.1,0.3)', () => {
    const boxes = nativeTheme(1).widgets.optionButton;
    expect(boxes.normal.bgColor).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 0.6 });
    expect(boxes.disabled.bgColor).toEqual({ r: 0.1, g: 0.1, b: 0.1, a: 0.3 });
  });
});

describe('the item OPTION_BUTTON_CLASS shows as Button text (option_button.cpp:423-424)', () => {
  const shownText = (props: Partial<OptionButtonProperties>) =>
    OPTION_BUTTON_CLASS.shown!(props as OptionButtonProperties).text;
  const items = [
    { text: 'Easy', id: 0 },
    { text: 'Normal', id: 1 },
  ];

  it('is the text of items[selected]', () => {
    expect(shownText({ items, selected: 1 })).toBe('Normal');
  });

  it('is empty when selected is out of range', () => {
    expect(shownText({ items, selected: 5 })).toBe('');
  });

  it('is empty when selected or items is absent', () => {
    expect(shownText({})).toBe('');
    expect(shownText({ selected: 0 })).toBe('');
  });
});

describe('optionButtonMinimumSize (option_button.cpp:50-68, fit_to_longest_item=true, the engine default)', () => {
  it('floors at margin + arrow contribution with zero items (no text at all)', () => {
    // width = marginX(16) + text(0) + arrow(12) + h_separation(4) = 32.
    // height = marginY(8) + max(text(0), arrow(12)) = 20.
    expect(optionButtonMinimumSize(node({}), ctx())).toEqual({ x: 16 + 12 + 4, y: 8 + 12 });
  });

  it('widens on a themed "arrow" icon (option_button.cpp:62 reads theme_cache.arrow_icon->get_size() directly)', () => {
    const n = { ...node({}), textureSlots: { arrow: { x: 20, y: 18 } } };
    expect(optionButtonMinimumSize(n, ctx())).toEqual({ x: 16 + 20 + 4, y: 8 + 18 });
  });

  it("uses the WIDEST item's text, not the selected one's, for the width floor", () => {
    const items = [
      { text: 'A', id: 0 }, // 10.578125 wide
      { text: 'AB', id: 1 }, // 21.125 wide, the widest
    ];
    const result = optionButtonMinimumSize(node({ items, selected: 0 }), ctx());
    // width = 16 (margin) + 21.125 (widest item) + 12 (arrow) + 4 (h_separation).
    expect(result.x).toBeCloseTo(16 + AB_SHAPED_WIDTH + 12 + 4, 6);
  });

  it('height is 8 (marginY) + max(tallest item text height, arrow height 12) — the 23px font height wins', () => {
    const items = [{ text: 'AB', id: 0 }];
    const result = optionButtonMinimumSize(node({ items, selected: 0 }), ctx());
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });

  it('treats an absent measurer as "no item contributes text width" — margin+arrow floor still returns', () => {
    const items = [{ text: 'AB', id: 0 }];
    const result = optionButtonMinimumSize(node({ items, selected: 0 }), ctx(false));
    expect(result).toEqual({ x: 16 + 12 + 4, y: 8 + 12 });
  });

  it('h_separation theme_override_constants wins over the theme default', () => {
    const items = [{ text: 'A', id: 0 }];
    const result = optionButtonMinimumSize(
      node({ items, selected: 0, themeOverrideConstants: { h_separation: 10 } }),
      ctx()
    );
    expect(result.x).toBe(16 + Math.ceil(A_ADVANCE) + 12 + 10);
  });

  it('uses the DISABLED stylebox margin once disabled=true (same margins in the default theme, so no numeric change)', () => {
    const result = optionButtonMinimumSize(node({ disabled: true }), ctx());
    expect(result).toEqual({ x: 16 + 12 + 4, y: 8 + 12 });
  });
});

describe("optionButtonMinimumSize: each item's icon (option_button.cpp:451, button.cpp:481-526)", () => {
  const withIcons = (
    props: Partial<OptionButtonProperties>,
    icons: Record<number, { x: number; y: number }>
  ) => ({
    ...node(props),
    textureSlots: Object.fromEntries(
      Object.entries(icons).map(([i, size]) => [`popup/item_${i}/icon`, size])
    ),
  });

  it("adds the icon's width and h_separation beside the text, and takes the taller of the two", () => {
    const n = withIcons(
      { items: [{ text: 'AB', id: 0, icon: 'ExtResource("1")' }] },
      { 0: { x: 20, y: 30 } }
    );
    // text 22 + 20 + 4 (h_separation) = 46; height max(23, 30) = 30; plus the arrow 12 + 4 and margins 16 by 8.
    expect(optionButtonMinimumSize(n, ctx())).toEqual({ x: 16 + 46 + 12 + 4, y: 8 + 30 });
  });

  it('counts an icon-only item by its icon alone, with no separation', () => {
    const n = withIcons({ items: [{ text: '', id: 0, icon: 'ExtResource("1")' }] }, { 0: { x: 20, y: 30 } });
    expect(optionButtonMinimumSize(n, ctx())).toEqual({ x: 16 + 20 + 12 + 4, y: 8 + 30 });
  });

  it("measures an empty item text as the button's own selected text (button.cpp:485-486, 515)", () => {
    const n = withIcons(
      {
        selected: 0,
        items: [
          { text: 'AB', id: 0 },
          { text: '', id: 1, icon: 'ExtResource("1")' },
        ],
      },
      { 1: { x: 20, y: 30 } }
    );
    // item 1 reuses `text_buf` ("AB", 22) beside its icon: 22 + 20 + 4 = 46, height max(23, 30).
    expect(optionButtonMinimumSize(n, ctx())).toEqual({ x: 16 + 46 + 12 + 4, y: 8 + 30 });
  });

  it('takes the widest item over text and icon together', () => {
    const n = withIcons(
      {
        items: [
          { text: 'AB', id: 0 },
          { text: 'A', id: 1, icon: 'ExtResource("1")' },
        ],
      },
      { 1: { x: 40, y: 10 } }
    );
    // item 1: ceil(10.58) = 11 + 40 + 4 = 55 beats item 0's 22.
    expect(optionButtonMinimumSize(n, ctx()).x).toBe(16 + 55 + 12 + 4);
  });

  it('leaves the icon out under expand_icon, which sizes it from the box', () => {
    const n = withIcons(
      { expandIcon: true, items: [{ text: 'AB', id: 0, icon: 'ExtResource("1")' }] },
      { 0: { x: 20, y: 30 } }
    );
    expect(optionButtonMinimumSize(n, ctx())).toEqual({ x: 16 + 22 + 12 + 4, y: 8 + 23 });
  });
});

describe(`optionButtonMinimumSize: resolves this OptionButton's own theme font key ("${BUTTON_THEME_FONT_KEY}", default_theme.cpp:237)`, () => {
  // An unresolvable font's warn is the observable proof here (`resolveNodeFontMetrics.test.ts`).
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('a theme_override_fonts/font local override is fed to the text engine (resolved unconditionally, before the per-item measurement loop)', () => {
    const unresolvableFont = fontFile(undefined);
    const n: SolveNode = { ...node({}), fontOverrides: { [BUTTON_THEME_FONT_KEY]: unresolvableFont } };
    optionButtonMinimumSize(n, ctx());
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('a local override under a different key is not consulted', () => {
    const unresolvableFont = fontFile(undefined);
    const n: SolveNode = { ...node({}), fontOverrides: { normal_font: unresolvableFont } };
    optionButtonMinimumSize(n, ctx());
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

/**
 * `OptionButton` sizes to its widest item through `Button::get_minimum_size_for_text_and_icon`
 * (`button.cpp:492`), whose `paragraph->get_size()` maxes the ceiled `TS->shaped_text_get_size(lines_rid[i])`
 * (`text_paragraph.cpp:601-608`, `text_server_adv.cpp:7524-7537`). Godot 4.6.3 on `complex-2d-gui.tscn`:
 * SystemsGrid/Difficulty, items "Recon"/"Standard"/"Blackout", min = (103, 31).
 */
describe('optionButtonMinimumSize: the shaped item extent is ceiled (text_server_adv.cpp:7524-7537)', () => {
  it("reaches Godot's own whole-pixel minimum width 103 for the Recon/Standard/Blackout item set", () => {
    const n = node({
      items: [
        { text: 'Recon', id: 0 },
        { text: 'Standard', id: 1 },
        { text: 'Blackout', id: 2 },
      ],
    });
    expect(optionButtonMinimumSize(n, ctx()).x).toBe(103);
  });
});

describe('optionButtonMinimumSize: clip_text zeroes each item text width (button.cpp:493-495)', () => {
  const items = [{ text: 'AB', id: 0 }];

  it('keeps the margins, the arrow and the text height, and drops the text width', () => {
    const result = optionButtonMinimumSize(node({ items, selected: 0, clipText: true }), ctx());
    expect(result).toEqual({ x: 16 + 12 + 4, y: 8 + FONT_HEIGHT });
  });

  it('keeps the widest item text width without clip_text', () => {
    const result = optionButtonMinimumSize(node({ items, selected: 0, clipText: false }), ctx());
    expect(result.x).toBe(16 + AB_SHAPED_WIDTH + 12 + 4);
  });
});

describe('optionButtonMinimumSize: a trimming text_overrun_behavior zeroes each item text width (button.cpp:493-495)', () => {
  const items = [{ text: 'AB', id: 0 }];

  it('drops the text width under OVERRUN_TRIM_ELLIPSIS', () => {
    const result = optionButtonMinimumSize(node({ items, selected: 0, overrunBehavior: 3 }), ctx());
    expect(result).toEqual({ x: 16 + 12 + 4, y: 8 + FONT_HEIGHT });
  });

  it('keeps the widest item text width under OVERRUN_NO_TRIMMING', () => {
    const result = optionButtonMinimumSize(node({ items, selected: 0, overrunBehavior: 0 }), ctx());
    expect(result.x).toBe(16 + AB_SHAPED_WIDTH + 12 + 4);
  });
});

describe('optionButtonMinimumSize: autowrap_mode zeroes each item text width and never wraps it (button.cpp:484-489,493-495)', () => {
  const items = [{ text: 'alpha bravo charlie', id: 0 }];

  it('drops the text width', () => {
    const result = optionButtonMinimumSize(node({ items, selected: 0, autowrapMode: 2 }), ctx());
    expect(result.x).toBe(16 + 12 + 4);
  });

  it('keeps one line of height, though a tentative width would wrap the drawn label', () => {
    const context: SolveContext = { ...ctx(), tentativeRect: () => ({ x: 0, y: 0, w: 80, h: 40 }) };
    const result = optionButtonMinimumSize(node({ items, selected: 0, autowrapMode: 2 }), context);
    expect(result.y).toBe(8 + FONT_HEIGHT);
  });
});

const RECT_SIZE = { x: 150, y: 32 };
const THEME = nativeTheme(1);

describe('optionButtonArrowRect (option_button.cpp:122-131)', () => {
  it('puts the arrow arrow_margin from the right edge of the whole control, not of the content', () => {
    // Content margins are 8 by 4 (default_theme.cpp:212-215), but `arrow_margin` (`:249`, round(4*scale))
    // counts from the full rect edge: `pnpm ref:godot scenes/fixtures/unit-optionbutton.tscn --mode 2d`
    // puts the chevron at 150 - 12 - 4 = 134. y = int(abs((32 - 12) / 2)).
    expect(optionButtonArrowRect(node({}), THEME, RECT_SIZE)).toEqual({ x: 134, y: 10, w: 12, h: 12 });
  });

  it('puts the arrow arrow_margin from the left edge under RTL', () => {
    expect(optionButtonArrowRect({ ...node({}), rtl: true }, THEME, RECT_SIZE)).toMatchObject({
      x: 4,
      y: 10,
    });
  });

  it('draws a themed arrow at its own size, never clamped by icon_max_width (option_button.cpp:131-133)', () => {
    const n = {
      ...node({ themeOverrideConstants: { icon_max_width: 8 } }),
      textureSlots: { arrow: { x: 40, y: 30 } },
    };
    expect(optionButtonArrowRect(n, THEME, RECT_SIZE)).toMatchObject({ w: 40, h: 30 });
  });

  it('keeps the 12x12 default while a themed arrow loads or after it fails (theme.cpp:306)', () => {
    const n = { ...node({}), textureSlots: { arrow: null } };
    expect(optionButtonArrowRect(n, THEME, RECT_SIZE)).toMatchObject({ w: 12, h: 12 });
  });

  it('reads a themed arrow_margin', () => {
    const n = node({ themeOverrideConstants: { arrow_margin: 20 } });
    expect(optionButtonArrowRect(n, THEME, RECT_SIZE).x).toBe(150 - 12 - 20);
  });
});

describe('optionButtonArrowColor (option_button.cpp:98-118)', () => {
  const RED = { r: 1, g: 0, b: 0, a: 1 };
  const GREEN = { r: 0, g: 1, b: 0, a: 1 };
  const BLUE = { r: 0, g: 0, b: 1, a: 1 };
  const WHITE = { r: 1, g: 1, b: 1, a: 1 };
  const themeOverrideColors = { font_color: RED, font_disabled_color: GREEN, font_focus_color: BLUE };
  const modulated = (props: Partial<OptionButtonProperties>) =>
    node({ ...props, themeOverrideColors, themeOverrideConstants: { modulate_arrow: 1 } });

  it('is white while modulate_arrow is off, the default (default_theme.cpp:251)', () => {
    expect(optionButtonArrowColor(node({ themeOverrideColors }), THEME)).toEqual(WHITE);
  });

  it("is the label's font colour of the draw state under modulate_arrow", () => {
    expect(optionButtonArrowColor(modulated({}), THEME)).toEqual(RED);
    expect(optionButtonArrowColor(modulated({ disabled: true }), THEME)).toEqual(GREEN);
  });

  it('is font_focus_color for a focused button in the normal draw mode (option_button.cpp:112-116)', () => {
    expect(optionButtonArrowColor(modulated({ hasFocus: true }), THEME)).toEqual(BLUE);
    expect(optionButtonArrowColor(modulated({ hasFocus: true, disabled: true }), THEME)).toEqual(GREEN);
  });
});

describe('optionButtonMinimumSize: fit_to_longest_item off (option_button.cpp:52-56)', () => {
  const items = [
    { text: 'AB', id: 0 },
    { text: 'ABABABAB', id: 1 },
  ];

  it('sizes to the selected item alone, where the default sizes to the longest', () => {
    const selected = optionButtonMinimumSize(node({ items, selected: 0, fitToLongestItem: false }), ctx());
    // 16 (margins) + 'AB' + arrow 12 + h_separation 4.
    expect(selected.x).toBe(16 + AB_SHAPED_WIDTH + 12 + 4);
    const longest = optionButtonMinimumSize(node({ items, selected: 0 }), ctx());
    expect(longest.x).toBeGreaterThan(selected.x);
  });

  it('wraps the selected label at the tentative width, which an item never does', () => {
    const context: SolveContext = { ...ctx(), tentativeRect: () => ({ x: 0, y: 0, w: 80, h: 40 }) };
    const wrapping = [{ text: 'alpha bravo charlie', id: 0 }];
    const props = { items: wrapping, selected: 0, autowrapMode: 2, fitToLongestItem: false };
    // 80 - 16 (margins) - 16 (arrow and separation) = 48 px: three rows.
    expect(optionButtonMinimumSize(node(props), context).y).toBe(8 + 3 * FONT_HEIGHT);
  });
});

describe('optionButtonMinimumSize: the boxes of the draw states (option_button.cpp:58-65,447)', () => {
  it("floors the longest item at the `normal` box's minimum size", () => {
    const normal = drawnStyleBox({ content_margin_left: '30', content_margin_right: '30' });
    // No item: `_cached_size` is the normal box's 60 px, and the arrow and its separation add 16.
    expect(optionButtonMinimumSize({ ...node({}), styleBoxes: { normal } }, ctx()).x).toBe(60 + 16);
  });
});
