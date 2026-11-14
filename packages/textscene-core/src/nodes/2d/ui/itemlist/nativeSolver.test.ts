/**
 * ItemList native solver versus Godot 4.6.3: `ItemList::force_update_list_size`
 * (`scene/gui/item_list.cpp:1733-1912`), the per-item minsize it computes
 * inline (`:1743-1796`), `_adjust_to_max_size` (`:1186-1197`) and
 * `ItemList::get_minimum_size` (`:2136-2146`).
 */
import { defaultThemeAt } from '../../../../godot/scene/defaultTheme/defaultTheme';
import { defaultConstantsOf } from '../../../../r3f/controls/native/defaultThemeRecords';
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import {} from '../../../../r3f/controls/native/text/openSansFontMetrics';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import type { ItemListProperties } from './types';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import {
  ICON_MODE_LEFT,
  itemIconPackedSize,
  itemListMaxColumnWidth,
  itemListSpacing,
  itemMinimumSize,
  packItemListRows,
} from './nativeSolver';
import {} from './mirrorX';
import { ItemListIconMode } from '../../../../godot/scene/gui';
import type { Vector2 } from '../../../../godot/math/vector';
import type {} from './nativeSolver';
import {} from '../../../../r3f/controls/native/text/textLayout';
import {} from '../../../../r3f/controls/native/text/textLayout.testkit';
import { ITEM_LIST_CASES, ITEM_LIST_SIZES, type ItemListCase } from './valueList.testdata';

const itemListMinimumSize = controlSolverRegistry.minimumSize('ItemList')!;

function node(props: Partial<ItemListProperties> = {}): SolveNode {
  return withThemeItems({
    ...solveNode(),
    path: 'IL',
    node: controlNode('IL', 'ItemList', { name: 'IL', items: [], ...props }),
  });
}

function ctx(withMeasurer = true): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: withMeasurer ? measureText : null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

/** One text-only item, TOP mode, one line: its minsize y is text + line_separation + v_separation. */
function topTextItem(textHeight: number) {
  return {
    hasIcon: false,
    iconSize: { x: 0, y: 0 },
    hasText: true,
    textSize: { x: 10, y: textHeight },
    iconMode: ItemListIconMode.ICON_MODE_TOP,
    maxTextLines: 1,
    fixedColumnWidth: 0,
  };
}

/** The ItemList constants of the default theme at `scale`, as the tree build gives a node with no override. */
function itemListConstantsAt(scale: number) {
  return defaultConstantsOf(defaultThemeAt(scale)).ItemList!;
}

describe('itemListSpacing', () => {
  it('is round(4*scale) and round(2*scale) at scale 1 (default_theme.cpp:945-948)', () => {
    expect(itemListSpacing(itemListConstantsAt(1))).toEqual({
      hSeparation: 4,
      vSeparation: 4,
      iconMargin: 4,
      lineSeparation: 2,
    });
  });

  it('scales with the project theme scale', () => {
    expect(itemMinimumSize(topTextItem(20), itemListSpacing(itemListConstantsAt(2))).y).toBe(20 + 4 + 8);
  });

  it('takes each constant the node overrides', () => {
    const constants = { h_separation: 10, v_separation: 6, icon_margin: 3, line_separation: 1 };
    expect(itemListSpacing({ ...itemListConstantsAt(1), ...constants })).toEqual({
      hSeparation: 10,
      vSeparation: 6,
      iconMargin: 3,
      lineSeparation: 1,
    });
  });
});

describe('itemIconPackedSize', () => {
  it('scales the natural icon size by icon_scale (happy path)', () => {
    expect(itemIconPackedSize(true, { x: 16, y: 16 }, undefined, 2)).toEqual({ x: 32, y: 32 });
  });

  it('is zero for an item with no icon (error path)', () => {
    expect(itemIconPackedSize(false, { x: 16, y: 16 }, undefined, 1)).toEqual({ x: 0, y: 0 });
  });

  it('uses fixed_icon_size (scaled) over the natural size once both axes are set (edge case)', () => {
    expect(itemIconPackedSize(true, { x: 16, y: 16 }, { x: 24, y: 24 }, 1.5)).toEqual({ x: 36, y: 36 });
  });

  it('treats an unresolved (null) natural size as zero contribution, not a crash', () => {
    expect(itemIconPackedSize(true, null, undefined, 1)).toEqual({ x: 0, y: 0 });
  });
});

describe('itemMinimumSize', () => {
  const spacing = itemListSpacing(itemListConstantsAt(1));

  it('LEFT icon mode: icon width + text width, max of the two heights (happy path)', () => {
    const min = itemMinimumSize(
      {
        hasIcon: true,
        iconSize: { x: 16, y: 16 },
        hasText: true,
        textSize: { x: 40, y: 20 },
        iconMode: ICON_MODE_LEFT,
        maxTextLines: 1,
        fixedColumnWidth: 0,
      },
      spacing
    );
    // x = 16(icon) + 4(icon_margin) + 40(text) = 60; y = max(16, 20) = 20; then h/v separation 4.
    expect(min).toEqual({ x: 60 + 4, y: 20 + 4 });
  });

  it('TOP icon mode: max of icon/text width, summed heights plus line_separation*max_text_lines (error path)', () => {
    const min = itemMinimumSize(
      {
        hasIcon: true,
        iconSize: { x: 16, y: 16 },
        hasText: true,
        textSize: { x: 40, y: 20 },
        iconMode: ItemListIconMode.ICON_MODE_TOP,
        maxTextLines: 2,
        fixedColumnWidth: 0,
      },
      spacing
    );
    // x = max(16, 40) = 40; y = 16(icon) + 4(icon_margin) + 20(text) + 2(line_separation)*2 = 44; then h/v separation 4.
    expect(min).toEqual({ x: 40 + 4, y: 44 + 4 });
  });

  it('fixed_column_width overrides the computed width outright (edge case)', () => {
    const min = itemMinimumSize(
      {
        hasIcon: false,
        iconSize: { x: 0, y: 0 },
        hasText: true,
        textSize: { x: 40, y: 20 },
        iconMode: ICON_MODE_LEFT,
        maxTextLines: 1,
        fixedColumnWidth: 96,
      },
      spacing
    );
    expect(min.x).toBe(96 + 4);
  });

  it('itemMinimumSize adds h/v separation on top of the content size', () => {
    const min = itemMinimumSize(
      {
        hasIcon: false,
        iconSize: { x: 0, y: 0 },
        hasText: true,
        textSize: { x: 10, y: 10 },
        iconMode: ICON_MODE_LEFT,
        maxTextLines: 1,
        fixedColumnWidth: 0,
      },
      spacing
    );
    expect(min).toEqual({ x: 14, y: 14 });
  });
});

/** The default theme's vertical scrollbar minimum width (`scrollBarMinimumSize(true, theme).x`). */
const VERTICAL_BAR_MIN_WIDTH = 8;

function packInput(overrides: Partial<Parameters<typeof packItemListRows>[0]>) {
  return {
    itemSizes: [],
    maxColumnWidth: 0,
    sameColumnWidth: false,
    maxColumns: 1,
    fitSize: Number.POSITIVE_INFINITY,
    verticalBarMinWidth: VERTICAL_BAR_MIN_WIDTH,
    rtl: false,
    wraparoundItems: true,
    autoWidth: false,
    hSeparation: 4,
    availableHeight: Number.POSITIVE_INFINITY,
    ...overrides,
  };
}

describe('packItemListRows', () => {
  const FOUR_ITEMS: Vector2[] = [
    { x: 20, y: 10 },
    { x: 20, y: 10 },
    { x: 20, y: 10 },
    { x: 20, y: 10 },
  ];

  it('packs 4 equal items into 2 columns, one separator between the two rows (happy path)', () => {
    const result = packItemListRows({
      itemSizes: FOUR_ITEMS,
      maxColumnWidth: 20,
      sameColumnWidth: false,
      maxColumns: 2,
      fitSize: Number.POSITIVE_INFINITY,
      verticalBarMinWidth: VERTICAL_BAR_MIN_WIDTH,
      rtl: false,
      wraparoundItems: true,
      autoWidth: false,
      hSeparation: 4,
      availableHeight: Number.POSITIVE_INFINITY,
    });
    expect(result.items.map((i) => i.rect)).toEqual([
      { x: 0, y: 0, w: 20, h: 10 },
      { x: 20, y: 0, w: 20, h: 10 },
      { x: 0, y: 10, w: 20, h: 10 },
      { x: 20, y: 10, w: 20, h: 10 },
    ]);
    expect(result.separators).toEqual([10]);
    expect(result.contentWidth).toBe(40);
    expect(result.contentHeight).toBe(20);
  });

  it('a narrow fit_size wraps to 1 column when max_columns is unbounded (error path)', () => {
    const result = packItemListRows({
      itemSizes: FOUR_ITEMS,
      maxColumnWidth: 20,
      sameColumnWidth: false,
      maxColumns: 0,
      fitSize: 25, // fits exactly one 20-wide item, not two
      verticalBarMinWidth: VERTICAL_BAR_MIN_WIDTH,
      rtl: false,
      wraparoundItems: true,
      autoWidth: false,
      hSeparation: 4,
      availableHeight: Number.POSITIVE_INFINITY,
    });
    expect(result.items.map((i) => i.rect.x)).toEqual([0, 0, 0, 0]);
    expect(result.contentWidth).toBe(20);
    expect(result.contentHeight).toBe(40);
  });

  it('auto_width disables the width-overflow wrap even with a narrow fit_size (edge case)', () => {
    const result = packItemListRows({
      itemSizes: FOUR_ITEMS,
      maxColumnWidth: 20,
      sameColumnWidth: false,
      maxColumns: 0,
      fitSize: 25,
      verticalBarMinWidth: VERTICAL_BAR_MIN_WIDTH,
      rtl: false,
      wraparoundItems: true,
      autoWidth: true,
      hSeparation: 4,
      availableHeight: Number.POSITIVE_INFINITY,
    });
    // All 4 items in one row, unbounded by fit_size.
    expect(result.items.map((i) => i.rect.x)).toEqual([0, 20, 40, 60]);
    expect(result.contentHeight).toBe(10);
  });

  it('same_column_width stretches every item to the widest one, plus h_separation', () => {
    const result = packItemListRows({
      itemSizes: [
        { x: 20, y: 10 },
        { x: 30, y: 10 },
      ],
      maxColumnWidth: 30,
      sameColumnWidth: true,
      maxColumns: 2,
      fitSize: Number.POSITIVE_INFINITY,
      verticalBarMinWidth: VERTICAL_BAR_MIN_WIDTH,
      rtl: false,
      wraparoundItems: true,
      autoWidth: false,
      hSeparation: 4,
      availableHeight: Number.POSITIVE_INFINITY,
    });
    expect(result.items[0]!.rect.w).toBe(34);
    expect(result.items[1]!.rect.w).toBe(34);
  });

  it('reports a visible vertical scrollbar once content height exceeds the available page', () => {
    const result = packItemListRows({
      itemSizes: FOUR_ITEMS,
      maxColumnWidth: 20,
      sameColumnWidth: false,
      maxColumns: 1,
      fitSize: Number.POSITIVE_INFINITY,
      verticalBarMinWidth: VERTICAL_BAR_MIN_WIDTH,
      rtl: false,
      wraparoundItems: true,
      autoWidth: false,
      hSeparation: 4,
      availableHeight: 10,
    });
    expect(result.vertical.visible).toBe(true);
  });

  // item_list.cpp:1854-1885 -- page = 80 less the panel's 8 px of vertical margin.
  const rows = (count: number): Vector2[] => Array.from({ length: count }, () => ({ x: 40, y: 23 }));

  it('shows the vertical bar for six 23 px rows in an 80 px list (happy path)', () => {
    const result = packItemListRows(packInput({ itemSizes: rows(6), availableHeight: 72 }));
    expect(result.vertical).toEqual({ visible: true, min: 0, max: 138, page: 72 });
  });

  it('hides the vertical bar for three rows in the same list (error path)', () => {
    const result = packItemListRows(packInput({ itemSizes: rows(3), availableHeight: 72 }));
    expect(result.vertical).toEqual({ visible: false, min: 0, max: 72, page: 72 });
  });

  it('shows the horizontal bar only without wraparound_items and with wider content (item_list.cpp:1856-1860)', () => {
    const wide = { itemSizes: rows(4), maxColumns: 0, fitSize: 100, availableHeight: 72 };
    const unwrapped = packItemListRows(packInput({ ...wide, wraparoundItems: false }));
    expect(unwrapped.horizontal).toEqual({ visible: true, min: 0, max: 160, page: 100 });
    const wrapped = packItemListRows(packInput({ ...wide, wraparoundItems: true }));
    expect(wrapped.horizontal.visible).toBe(false);
  });

  it('mirrors the horizontal range under RTL without wraparound_items (item_list.cpp:1891-1893)', () => {
    const result = packItemListRows(
      packInput({ itemSizes: rows(4), maxColumns: 0, fitSize: 100, wraparoundItems: false, rtl: true })
    );
    expect(result.horizontal).toEqual({ visible: true, min: -60, max: 100, page: 100 });
  });

  describe('fit_size trim (item_list.cpp:1862-1863)', () => {
    // Five 40 px items at max_columns 0. The first attempt overflows at 85 px and settles on two
    // columns; the second attempt then runs at 85 - 8 = 77 px, where two columns no longer fit.
    const sizes: Vector2[] = Array.from({ length: 5 }, () => ({ x: 40, y: 10 }));
    const columnsOf = (overrides: Partial<Parameters<typeof packItemListRows>[0]>) =>
      packItemListRows(packInput({ itemSizes: sizes, maxColumns: 0, fitSize: 85, ...overrides })).items.map(
        (i) => i.column
      );

    it('takes the bar width off when the page holds the content', () => {
      expect(columnsOf({ availableHeight: 100 })).toEqual([0, 0, 0, 0, 0]);
    });

    it('takes the bar width off under RTL even when the content overflows', () => {
      expect(columnsOf({ availableHeight: 5, rtl: true })).toEqual([0, 0, 0, 0, 0]);
    });

    it('keeps fit_size when LTR content overflows the page', () => {
      expect(columnsOf({ availableHeight: 5 })).toEqual([0, 1, 0, 1, 0]);
    });
  });
});

describe('itemListMinimumSize', () => {
  it('is (0, 0) when neither auto_width nor auto_height is set (happy path)', () => {
    const result = itemListMinimumSize(node({ items: [{ text: 'Sword' }] }), ctx());
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it('floors auto_width against the packed content width plus the panel margin (error path)', () => {
    const n = node({ autoWidth: true, maxColumns: 1, items: [{ text: 'Sword' }] });
    const result = itemListMinimumSize(n, ctx());
    expect(result.x).toBeGreaterThan(0);
    expect(result.y).toBe(0);
  });

  it('adds the h_separation and v_separation the node overrides (item_list.cpp:1789-1790)', () => {
    const items = [{ text: 'Sword' }, { text: 'Shield' }];
    const plain = node({ autoWidth: true, autoHeight: true, maxColumns: 1, items });
    const spaced = { ...plain, constants: { ...plain.constants, h_separation: 20, v_separation: 12 } };
    const before = itemListMinimumSize(plain, ctx());
    const after = itemListMinimumSize(spaced, ctx());
    // Default 4 each: one column grows by 20 - 4, two rows by 2 * (12 - 4).
    expect(after.x - before.x).toBe(16);
    expect(after.y - before.y).toBe(16);
  });

  it('contributes zero text size when no measurer is wired, never throwing (edge case)', () => {
    const n = node({ autoWidth: true, autoHeight: true, items: [{ text: 'Sword' }] });
    expect(() => itemListMinimumSize(n, ctx(false))).not.toThrow();
  });

  describe('scrollbar terms from the tentative rect (item_list.cpp:1883,1903)', () => {
    const sixRows = Array.from({ length: 6 }, () => ({ text: 'Sword' }));
    const withRect = (rect: { x: number; y: number; w: number; h: number }): SolveContext => ({
      ...ctx(),
      tentativeRect: () => rect,
    });

    it('auto_width adds the vertical bar width once the list overflows its height', () => {
      const n = node({ autoWidth: true, items: sixRows });
      const free = itemListMinimumSize(n, ctx());
      const overflowing = itemListMinimumSize(n, withRect({ x: 0, y: 0, w: 120, h: 40 }));
      expect(overflowing.x - free.x).toBe(8);
    });

    it('auto_width adds nothing while the rows fit the height', () => {
      const n = node({ autoWidth: true, items: sixRows });
      const roomy = itemListMinimumSize(n, withRect({ x: 0, y: 0, w: 120, h: 400 }));
      expect(roomy.x).toBe(itemListMinimumSize(n, ctx()).x);
    });

    it('auto_height adds the horizontal bar height when wraparound_items is off and the rows are wider than the list', () => {
      const n = node({ autoHeight: true, wraparoundItems: false, maxColumns: 0, items: sixRows });
      const free = itemListMinimumSize(n, ctx());
      const narrow = itemListMinimumSize(n, withRect({ x: 0, y: 0, w: 60, h: 100 }));
      expect(narrow.y - free.y).toBe(8);
    });
  });
});

describe('itemListMaxColumnWidth', () => {
  it('is the widest item width less the separation each width already carries', () => {
    expect(
      itemListMaxColumnWidth(
        [
          { x: 34, y: 10 },
          { x: 20, y: 10 },
        ],
        4
      )
    ).toBe(30);
  });
  it('subtracts nothing for a negative separation, which adds nothing', () => {
    expect(itemListMaxColumnWidth([{ x: 34, y: 10 }], -4)).toBe(34);
  });
  it('is zero without items', () => {
    expect(itemListMaxColumnWidth([], 4)).toBe(0);
  });
});

// item_list.cpp:1624: only TOP mode with max_text_lines above 0 draws the wrapped paragraph.
describe('itemListMinimumSize across the value list, at each size the solve asks for', () => {
  /** Each case's minimum at (inf, inf), (200, 100) and (60, 40), measured before the layout share existed. */
  const EXPECTED: Record<string, readonly (readonly [number, number])[]> = {
    'no item': [
      [8, 8],
      [8, 8],
      [8, 8],
    ],
    'one item with no text': [
      [12, 12],
      [12, 12],
      [12, 12],
    ],
    'icons of two sizes': [
      [176, 63],
      [176, 63],
      [184, 63],
    ],
    'icons with fixed_icon_size': [
      [156, 62],
      [156, 62],
      [164, 62],
    ],
    'icon_mode top': [
      [132, 114],
      [140, 114],
      [140, 114],
    ],
    'icon_mode left': [
      [176, 63],
      [176, 63],
      [184, 63],
    ],
    'max_text_lines 1, icon_mode top': [
      [127, 95],
      [127, 95],
      [135, 95],
    ],
    'max_text_lines 3, icon_mode top': [
      [127, 107],
      [135, 107],
      [135, 107],
    ],
    'max_columns 0': [
      [603, 35],
      [603, 35],
      [603, 35],
    ],
    'max_columns 1': [
      [127, 143],
      [135, 143],
      [135, 143],
    ],
    'max_columns 3': [
      [365, 62],
      [365, 62],
      [373, 62],
    ],
    same_column_width: [
      [365, 62],
      [365, 62],
      [373, 62],
    ],
    'fixed_column_width 80': [
      [260, 62],
      [260, 62],
      [268, 62],
    ],
    'auto_width only': [
      [127, 0],
      [127, 0],
      [135, 0],
    ],
    'auto_height only': [
      [0, 89],
      [0, 89],
      [0, 89],
    ],
    'auto_width and auto_height': [
      [127, 89],
      [127, 89],
      [135, 89],
    ],
    'right to left': [
      [127, 89],
      [127, 89],
      [135, 89],
    ],
    'more rows than fit': [
      [137, 332],
      [145, 332],
      [145, 332],
    ],
  };

  function caseNode(c: ItemListCase): SolveNode {
    const textureSlots = Object.fromEntries(
      Object.entries(c.icons ?? {}).map(([index, size]) => [`item_${index}`, size])
    );
    return { ...node(c.props), rtl: c.rtl === true, textureSlots };
  }

  function minimumAt(n: SolveNode, size: Vector2, withMeasurer = true): [number, number] {
    const tentative = Number.isFinite(size.x) ? { x: 0, y: 0, w: size.x, h: size.y } : undefined;
    const min = itemListMinimumSize(n, {
      ...ctx(withMeasurer),
      tentativeRect: tentative && (() => tentative),
    });
    return [min.x, min.y];
  }

  it.each(ITEM_LIST_CASES.map((c) => [c.name, c] as const))('%s', (name, c) => {
    const n = caseNode(c);
    expect(ITEM_LIST_SIZES.map((size) => minimumAt(n, size))).toEqual(EXPECTED[name]);
  });

  it('gives a text no size without a measurer', () => {
    const n = caseNode(ITEM_LIST_CASES.find((c) => c.name === 'auto_width and auto_height')!);
    expect(ITEM_LIST_SIZES.map((size) => minimumAt(n, size, false))).toEqual([
      [12, 20],
      [12, 20],
      [12, 20],
    ]);
  });
});
