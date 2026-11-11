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
  optionButtonMinimumSize,
  optionButtonTextTheme,
  resolveOptionButtonSelectedText,
  layoutOptionButtonContent as layoutContent,
  optionItemIconSlotKey,
  optionButtonArrowSize,
  optionButtonTextureSlots,
  OPTION_BUTTON_THEME_FONT_KEY,
} from './nativeSolver';
import { controlNode, solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { ButtonContentInput } from '../../../../r3f/controls/native/buttonBase';
import { controlProps } from '../control/testing/controlProps';
import { BUTTON_ICON_SLOT_KEY, internalMarginAt } from '../../../../r3f/controls/native/buttonBase';

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

  it('requests one slot for a themed arrow', () => {
    const requests = optionButtonTextureSlots(controlNode('Opt', 'OptionButton'), { arrow: themed });
    expect(requests.map(({ key }) => key)).toEqual(['arrow']);
  });

  it('requests none when no arrow is themed', () => {
    expect(optionButtonTextureSlots(controlNode('Opt', 'OptionButton'), {})).toEqual([]);
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
      [BUTTON_ICON_SLOT_KEY, 'ExtResource("2")'],
      [optionItemIconSlotKey(0), 'ExtResource("1")'],
      [optionItemIconSlotKey(1), 'ExtResource("2")'],
    ]);
  });

  it('requests no Button icon when nothing is selected, though each item still sizes the minimum', () => {
    expect(slots({ items }).map(({ key }) => key)).toEqual([
      optionItemIconSlotKey(0),
      optionItemIconSlotKey(1),
    ]);
  });

  it('requests no Button icon for a selected item without an icon', () => {
    expect(slots({ items, selected: 2 }).map(({ key }) => key)).toEqual([
      optionItemIconSlotKey(0),
      optionItemIconSlotKey(1),
    ]);
  });
});

describe('optionButtonArrowSize', () => {
  it("is option_button_arrow.svg's own authored 12x12 when no arrow is themed", () => {
    expect(optionButtonArrowSize({ textureSlots: {} })).toEqual({ x: 12, y: 12 });
  });

  it('is a themed arrow at its own size, never clamped by icon_max_width', () => {
    expect(optionButtonArrowSize({ textureSlots: { arrow: { x: 40, y: 30 } } })).toEqual({ x: 40, y: 30 });
  });

  it('keeps the default while the themed arrow loads or after it fails (theme.cpp:306)', () => {
    expect(optionButtonArrowSize({ textureSlots: { arrow: null } })).toEqual({ x: 12, y: 12 });
  });

  it('ignores a themed texture in another slot (edge case)', () => {
    expect(optionButtonArrowSize({ textureSlots: { icon: { x: 40, y: 30 } } })).toEqual({ x: 12, y: 12 });
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

describe("resolveOptionButtonSelectedText (parity with Component.tsx's own bounds-guarded lookup)", () => {
  it('resolves items[selected].text when selected is a valid index', () => {
    const items = [
      { text: 'Easy', id: 0 },
      { text: 'Normal', id: 1 },
      { text: 'Hard', id: 2 },
    ];
    expect(resolveOptionButtonSelectedText({ items, selected: 1 } as OptionButtonProperties)).toBe('Normal');
  });

  it('is empty string when selected is out of range', () => {
    const items = [{ text: 'Easy', id: 0 }];
    expect(resolveOptionButtonSelectedText({ items, selected: 5 } as OptionButtonProperties)).toBe('');
  });

  it('is empty string when selected is absent or items is absent', () => {
    expect(resolveOptionButtonSelectedText({} as OptionButtonProperties)).toBe('');
    expect(resolveOptionButtonSelectedText({ selected: 0 } as OptionButtonProperties)).toBe('');
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
      Object.entries(icons).map(([i, size]) => [optionItemIconSlotKey(Number(i)), size])
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

describe('optionButtonTextTheme', () => {
  it('resolves control_font_color for the normal state', () => {
    // default_theme.cpp:101,240: control_font_color.
    expect(optionButtonTextTheme(node({}), {} as OptionButtonProperties, 'normal', ctx())).toEqual({
      fontSizePx: 16,
      color: { r: 0.875, g: 0.875, b: 0.875, a: 1 },
    });
  });

  it('resolves control_font_disabled_color for the disabled state', () => {
    // default_theme.cpp:106,245: control_font_disabled_color.
    expect(optionButtonTextTheme(node({}), {} as OptionButtonProperties, 'disabled', ctx()).color).toEqual({
      r: 0.875,
      g: 0.875,
      b: 0.875,
      a: 0.5,
    });
  });

  it('a theme_override_colors/font_color override wins over the default', () => {
    const props: OptionButtonProperties = controlProps({
      name: 'O',
      textDirection: 0,
      language: '',
      themeOverrideColors: { font_color: { r: 1, g: 0, b: 0, a: 1 } },
    });
    expect(optionButtonTextTheme(node(props), props, 'normal', ctx()).color).toEqual({
      r: 1,
      g: 0,
      b: 0,
      a: 1,
    });
  });
});

const LAYOUT_BASE = {
  rectSize: { x: 150, y: 32 },
  styleMargin: { left: 8, top: 4, right: 8, bottom: 4 },
  arrowSize: { x: 12, y: 12 },
  arrowMargin: 4,
  hSeparation: 4,
  textHeightPx: 26,
  textAlignment: 0,
  rtl: false,
};

/** The facts the painter builds for a label of `textHeightPx` and an arrow of `arrowSize`, as the tests state them. */
function layoutOptionButtonContent(input: typeof LAYOUT_BASE & Partial<ButtonContentInput>) {
  const { arrowSize, arrowMargin, textHeightPx, ...rest } = input;
  const layout = layoutContent({
    arrowSize,
    arrowMargin,
    content: {
      iconMaxWidth: 0,
      iconAlignment: 0,
      verticalIconAlignment: 1,
      expandIcon: false,
      iconNaturalSize: null,
      hasText: true,
      textNaturalSize: { x: 50, y: textHeightPx },
      isTextRtl: false,
      isClipped: false,
      internalMargin: internalMarginAt(input.rtl ? 'left' : 'right', arrowSize.x),
      ...rest,
    },
  });
  // `hasText` is true above, so the box exists.
  return { ...layout, labelBox: layout.labelBox! };
}

describe('layoutOptionButtonContent (option_button.cpp:95-135 + button.cpp:247-260,444-456)', () => {
  it('the arrow sits at (rect.w - arrowSize.w - arrowMargin), NOT the content-margin edge', () => {
    const { arrowRect } = layoutOptionButtonContent(LAYOUT_BASE);
    // Content margins are 8 by 4 (default_theme.cpp:212-215), but
    // `arrow_margin` (`:249`, round(4*scale)) counts from the full rect edge: `pnpm ref:godot
    // scenes/fixtures/unit-optionbutton.tscn --mode 2d` puts the chevron at 150 - 12 - 4 = 134, not 150 - 12 - 8.
    // Probe: fill at (649,y) = 46 and background at (651,y) = 76, so the box ends flush; chevron ink at (641,y).
    expect(arrowRect.x).toBe(134);
  });

  it('the arrow is vertically centred within the FULL rect height (not the content box)', () => {
    const { arrowRect } = layoutOptionButtonContent(LAYOUT_BASE);
    // floor(abs((32-12)/2)) = 10.
    expect(arrowRect.y).toBe(10);
  });

  it('the label box starts flush at the LEFT content margin and stops short of the arrow and its h_separation', () => {
    const { labelBox } = layoutOptionButtonContent(LAYOUT_BASE);
    // width = 150 - 8 - 8 - (12 + 4) = 118. customElementHeight = 32-8=24; topPx = (24-26)/2 + 4 = 3.
    expect(labelBox).toEqual({ leftPx: 8, topPx: 3, widthPx: 118, alignment: 0 });
  });

  it("floors a half-pixel centring remainder DOWN, matching Button's own text_ofs.y (never floored in the source itself, only per-glyph — text_server_adv.cpp:4083) — the ACTUAL 'Normal' item at font size 16 (ascent 18 + descent 5 = 23)", () => {
    // customElementHeight = 32-8=24; (24-23)/2=0.5; +styleMargin.top(4)=4.5 -> floor 4.
    const { labelBox } = layoutOptionButtonContent({ ...LAYOUT_BASE, textHeightPx: 23 });
    expect(labelBox.topPx).toBe(4);
  });

  it('hands the authored alignment to the drawn label', () => {
    expect(layoutOptionButtonContent({ ...LAYOUT_BASE, textAlignment: 1 }).labelBox.alignment).toBe(1);
    expect(layoutOptionButtonContent({ ...LAYOUT_BASE, textAlignment: 2 }).labelBox.alignment).toBe(2);
  });

  it('keeps the unceiled drawable width: the ceiling belongs to the drawn label (button.cpp:437)', () => {
    expect(
      layoutOptionButtonContent({ ...LAYOUT_BASE, rectSize: { x: 150.5, y: 32 } }).labelBox.widthPx
    ).toBe(118.5);
  });
});

/**
 * `OptionButton::_notification`'s RTL arms: the arrow moves to
 * `ofs = Point2(theme_cache.arrow_margin, int(Math::abs((size.height - arrow_icon->get_height()) / 2)))`
 * (option_button.cpp:126), the internal margin reserves SIDE_LEFT instead of SIDE_RIGHT (`:141-143`), and
 * the constructor's `HORIZONTAL_ALIGNMENT_LEFT` (`:654`) becomes RIGHT through Button's swap (`button.cpp:271-275`).
 */
describe('layoutOptionButtonContent: RTL puts the arrow on the left', () => {
  const RTL = { ...LAYOUT_BASE, rtl: true };

  it('draws the arrow at arrow_margin from the LEFT edge, vertically unchanged', () => {
    const { arrowRect } = layoutOptionButtonContent(RTL);
    expect(arrowRect).toEqual({ x: 4, y: 10, w: 12, h: 12 });
  });

  it('puts the label box right of the arrow and aligns a LEFT label RIGHT', () => {
    const { labelBox } = layoutOptionButtonContent(RTL);
    // reserved = 12+4 = 16 on the LEFT; drawable = 150-8-8-16 = 118; leftPx = 8 + 16.
    expect(labelBox).toEqual({ leftPx: 24, topPx: 3, widthPx: 118, alignment: 2 });
  });

  it('leaves CENTER alone and swaps RIGHT to LEFT', () => {
    expect(layoutOptionButtonContent({ ...RTL, textAlignment: 1 }).labelBox.alignment).toBe(1);
    expect(layoutOptionButtonContent({ ...RTL, textAlignment: 2 }).labelBox.alignment).toBe(0);
  });

  it('moves the label with h_separation, which the LTR arm never feels', () => {
    expect(layoutOptionButtonContent({ ...RTL, hSeparation: 10 }).labelBox.leftPx).toBe(30);
    expect(layoutOptionButtonContent({ ...LAYOUT_BASE, hSeparation: 10 }).labelBox.leftPx).toBe(8);
  });
});

describe(`optionButtonMinimumSize: resolves this OptionButton's own theme font key ("${OPTION_BUTTON_THEME_FONT_KEY}", default_theme.cpp:237)`, () => {
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
    const n: SolveNode = { ...node({}), fontOverrides: { [OPTION_BUTTON_THEME_FONT_KEY]: unresolvableFont } };
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

describe("layoutOptionButtonContent: the selected item's icon (button.cpp:333-405)", () => {
  const WITH_ICON = { ...LAYOUT_BASE, iconNaturalSize: { x: 12, y: 12 } };

  it('draws a LEFT icon at the left margin and moves the label past it and h_separation', () => {
    const { icon, labelBox } = layoutOptionButtonContent(WITH_ICON);
    // y = 4 + (24 - 12) / 2 = 10; the label keeps its width less 12 + 4: 118 - 16 = 102.
    expect(icon!.rect).toEqual({ x: 8, y: 10, w: 12, h: 12 });
    expect(labelBox).toMatchObject({ leftPx: 24, widthPx: 102 });
  });

  it('draws a RIGHT icon short of the arrow and its separation', () => {
    const { icon } = layoutOptionButtonContent({ ...WITH_ICON, iconAlignment: 2 });
    // 150 - 8 (margin) - 16 (arrow + separation) - 12.
    expect(icon!.rect.x).toBe(114);
  });

  it('draws no icon without a natural size', () => {
    expect(layoutOptionButtonContent(LAYOUT_BASE).icon).toBeNull();
  });
});
