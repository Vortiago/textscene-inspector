/**
 * ItemList native solver versus Godot 4.6.3: `ItemList::force_update_list_size`
 * (`scene/gui/item_list.cpp:1733-1912`), the per-item minsize it computes
 * inline (`:1743-1796`), `_adjust_to_max_size` (`:1186-1197`) and
 * `ItemList::get_minimum_size` (`:2136-2146`).
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { OPEN_SANS_FONT_METRICS } from '../../../../r3f/controls/native/text/openSansFontMetrics';
import { controlNode, solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import type { ItemListProperties } from './types';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import {
  ICON_MODE_LEFT,
  itemIconColor,
  itemIconDraw,
  itemIconPackedSize,
  itemListGuideColor,
  itemListDrawClip,
  itemListGuideLines,
  itemListMirrorX,
  itemListRowsInClip,
  itemListSeparatorsInClip,
  itemListMaxColumnWidth,
  itemListRowTextX,
  itemListLineTextWidthPx,
  itemListWrappedTextWidthPx,
  itemListSeparation,
  itemMinimumSize,
  itemTextColor,
  itemTextDrawOffset,
  packItemListRows,
  shapeItemListText,
} from './nativeSolver';
import { ItemListIconMode } from '../../../../godot/scene/gui';
import type { Vector2 } from '../../../../godot/math/vector';
import type { ItemListScrollRange } from './nativeSolver';
import { shapedTextSizeWidthPx } from '../../../../r3f/controls/native/text/textLayout';

const itemListMinimumSize = controlSolverRegistry.minimumSize('ItemList')!;

function node(props: Partial<ItemListProperties> = {}): SolveNode {
  return {
    ...solveNode(),
    path: 'IL',
    node: controlNode('IL', 'ItemList', { name: 'IL', items: [], ...props }),
  };
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

describe('itemListSeparation / line_separation', () => {
  it('is round(4*scale) / round(2*scale) at scale 1 (happy path)', () => {
    expect(itemListSeparation(nativeTheme(1))).toBe(4);
    // default_theme.cpp:949 sets line_separation to round(2 * scale).
    expect(itemMinimumSize(topTextItem(20), nativeTheme(1)).y).toBe(20 + 2 + 4);
  });

  it('scales with the project theme scale (edge case)', () => {
    expect(itemListSeparation(nativeTheme(2))).toBe(8);
    expect(itemMinimumSize(topTextItem(20), nativeTheme(2)).y).toBe(20 + 4 + 8);
  });
});

describe('shapeItemListText — wrapping (item_list.cpp:37-55)', () => {
  const wrapInput = {
    text: 'AA AA AA',
    fontSizePx: 16,
    fontMetrics: OPEN_SANS_FONT_METRICS,
    widthPx: 30,
    overrunBehavior: 0,
  };

  it('wraps only TOP icon mode with max_text_lines > 0 (happy path)', () => {
    expect(
      shapeItemListText({ ...wrapInput, iconMode: ItemListIconMode.ICON_MODE_TOP, maxTextLines: 2 })!.lines
        .length
    ).toBeGreaterThan(1);
  });

  it('never wraps LEFT icon mode, whatever max_text_lines (error path)', () => {
    expect(
      shapeItemListText({ ...wrapInput, iconMode: ICON_MODE_LEFT, maxTextLines: 2 })!.lines
    ).toHaveLength(1);
  });

  it('never wraps TOP icon mode with max_text_lines <= 0 (edge case)', () => {
    expect(
      shapeItemListText({ ...wrapInput, iconMode: ItemListIconMode.ICON_MODE_TOP, maxTextLines: 0 })!.lines
    ).toHaveLength(1);
  });
});

describe('shapeItemListText — overrun trim (item_list.h:131 default OVERRUN_TRIM_ELLIPSIS)', () => {
  const baseInput = {
    fontSizePx: 16,
    fontMetrics: OPEN_SANS_FONT_METRICS,
    iconMode: ICON_MODE_LEFT,
    maxTextLines: 1,
  };

  it('trims to the shape width by default, appending an ellipsis (matches text_overrun.test.ts derivation)', () => {
    const layout = shapeItemListText({ ...baseInput, text: 'AAAAAAAAAAAA', widthPx: 100 });
    expect(layout!.lines[0]!.text).toBe('AAAAAAAA…');
  });

  it('is a no-op at an unconstrained shape width — nothing to trim against', () => {
    const layout = shapeItemListText({ ...baseInput, text: 'AAAAAAAAAAAA', widthPx: 0 });
    expect(layout!.lines[0]!.text).toBe('AAAAAAAAAAAA');
  });

  it('OVERRUN_NO_TRIMMING (0) leaves the text untrimmed at a constrained width', () => {
    const layout = shapeItemListText({
      ...baseInput,
      text: 'AAAAAAAAAAAA',
      widthPx: 100,
      overrunBehavior: 0,
    });
    expect(layout!.lines[0]!.text).toBe('AAAAAAAAAAAA');
  });
});

/**
 * Measured through `TextParagraph` with `ItemList::_shape_text`'s break flags, overrun behaviour and
 * `max_lines_visible` (Godot 4.6.3, `item_list.cpp:37-55`), at the width each pass hands `set_width`.
 * Widths are `shaped_text_get_width`, ceiled. Heights are one 23 px line each at 16 px Open Sans.
 */
describe('shapeItemListText — against TextParagraph (text_paragraph.cpp:225-266)', () => {
  const LINE_HEIGHT_PX = 23;
  const cases = [
    // A word wider than the box breaks at the last glyph that fits (BREAK_GRAPHEME_BOUND wins).
    {
      name: 'breaks a long word per glyph',
      text: 'Supercalifragilistic',
      top: true,
      overrun: 3,
      max: 3,
      width: 56,
      lines: ['Superc', 'alifragi', 'listic'],
      widths: [54, 54, 36],
    },
    // Three lines show, the fourth hides, so the last shown line ends in an ellipsis.
    {
      name: 'ends the last visible line in an ellipsis',
      text: 'Healing potion bottle',
      top: true,
      overrun: 3,
      max: 3,
      width: 56,
      lines: ['Healin', 'g potio', 'n bot…'],
      widths: [50, 54, 54],
    },
    {
      name: 'hides lines past max_text_lines',
      text: 'Supercalifragilistic',
      top: true,
      overrun: 3,
      max: 2,
      width: 56,
      lines: ['Superc', 'alifra…'],
      widths: [54, 54],
    },
    {
      name: 'a single visible line ends in the ellipsis',
      text: 'Healing potion bottle',
      top: true,
      overrun: 3,
      max: 1,
      width: 56,
      lines: ['Heali…'],
      widths: [53],
    },
    {
      name: 'OVERRUN_NO_TRIMMING hides lines without an ellipsis',
      text: 'Supercalifragilistic',
      top: true,
      overrun: 0,
      max: 2,
      width: 56,
      lines: ['Superc', 'alifragi'],
      widths: [54, 54],
    },
    {
      name: 'OVERRUN_TRIM_CHAR keeps the hidden-line cut without an ellipsis',
      text: 'Healing potion bottle',
      top: true,
      overrun: 1,
      max: 2,
      width: 56,
      lines: ['Healin', 'g potio'],
      widths: [50, 54],
    },
    {
      name: 'OVERRUN_TRIM_WORD_ELLIPSIS cuts at a word',
      text: 'Healing potion bottle',
      top: true,
      overrun: 4,
      max: 2,
      width: 56,
      lines: ['Healin', 'g po …'],
      widths: [50, 50],
    },
    {
      name: 'OVERRUN_TRIM_ELLIPSIS_FORCE',
      text: 'Healing potion bottle',
      top: true,
      overrun: 5,
      max: 2,
      width: 56,
      lines: ['Healin', 'g pot…'],
      widths: [50, 53],
    },
    {
      name: 're-wraps at a narrower width than the text',
      text: 'Long word another',
      top: true,
      overrun: 3,
      max: 2,
      width: 54,
      lines: ['Long', 'word…'],
      widths: [38, 53],
    },
    {
      name: 'trims edge spaces at a break',
      text: 'AA   BB   CC',
      top: true,
      overrun: 3,
      max: 3,
      width: 30,
      lines: ['AA', 'BB', 'CC'],
      widths: [22, 22, 21],
    },
    {
      name: 'breaks at a mandatory newline unconstrained',
      text: 'AB\nCD',
      top: true,
      overrun: 3,
      max: 3,
      width: -1,
      lines: ['AB', 'CD'],
      widths: [22, 22],
    },
    {
      name: 'keeps a LEFT label on one line across a newline',
      text: 'AB\nCD',
      top: false,
      overrun: 3,
      max: 1,
      width: -1,
      lines: ['AB\nCD'],
      widths: [43],
    },
    {
      name: 'draws a fitting LEFT label whole under OVERRUN_TRIM_ELLIPSIS_FORCE',
      text: 'Short',
      top: false,
      overrun: 5,
      max: 1,
      width: 70,
      lines: ['Short'],
      widths: [42],
    },
    {
      name: 'draws a fitting LEFT label whole under OVERRUN_TRIM_WORD_ELLIPSIS_FORCE',
      text: 'Short',
      top: false,
      overrun: 6,
      max: 1,
      width: 70,
      lines: ['Short'],
      widths: [42],
    },
    {
      name: 'cuts an overflowing LEFT label under 6 characters without an ellipsis',
      text: 'Short',
      top: false,
      overrun: 3,
      max: 1,
      width: 30,
      lines: ['Sho'],
      widths: [29],
    },
    {
      name: 'ends an overflowing short LEFT label in an ellipsis under OVERRUN_TRIM_ELLIPSIS_FORCE',
      text: 'Short',
      top: false,
      overrun: 5,
      max: 1,
      width: 30,
      lines: ['S…'],
      widths: [22],
    },
    {
      name: 'ends an overflowing short LEFT label in a word ellipsis under OVERRUN_TRIM_WORD_ELLIPSIS_FORCE',
      text: 'A bc',
      top: false,
      overrun: 6,
      max: 1,
      width: 20,
      lines: ['…'],
      widths: [17],
    },
    {
      name: 'trims a LEFT label with an ellipsis',
      text: 'A very long item name',
      top: false,
      overrun: 3,
      max: 1,
      width: 70,
      lines: ['A very l…'],
      widths: [70],
    },
    {
      name: 'trims a LEFT label per char',
      text: 'A very long item name',
      top: false,
      overrun: 1,
      max: 1,
      width: 70,
      lines: ['A very lo'],
      widths: [67],
    },
    {
      name: 'trims a LEFT label per word',
      text: 'A very long item name',
      top: false,
      overrun: 2,
      max: 1,
      width: 70,
      lines: ['A very'],
      widths: [48],
    },
    {
      name: 'forces the LEFT ellipsis',
      text: 'A very long item name',
      top: false,
      overrun: 5,
      max: 1,
      width: 70,
      lines: ['A very l…'],
      widths: [70],
    },
    {
      name: 'leaves a LEFT label whole at OVERRUN_NO_TRIMMING',
      text: 'A very long item name',
      top: false,
      overrun: 0,
      max: 1,
      width: 70,
      lines: ['A very long item name'],
      widths: [173],
    },
    {
      name: 'leaves a LEFT label whole at zero width',
      text: 'A very long item name',
      top: false,
      overrun: 3,
      max: 1,
      width: 0,
      lines: ['A very long item name'],
      widths: [173],
    },
    {
      name: 'leaves a LEFT label whole at negative width',
      text: 'A very long item name',
      top: false,
      overrun: 3,
      max: 1,
      width: -8,
      lines: ['A very long item name'],
      widths: [173],
    },
  ];

  it.each(cases)('$name', ({ text, top, overrun, max, width, lines, widths }) => {
    const layout = shapeItemListText({
      text,
      fontSizePx: 16,
      fontMetrics: OPEN_SANS_FONT_METRICS,
      iconMode: top ? ItemListIconMode.ICON_MODE_TOP : ICON_MODE_LEFT,
      maxTextLines: max,
      widthPx: width,
      overrunBehavior: overrun,
    })!;
    expect(layout.lines.map((line) => line.text)).toEqual(lines);
    expect(layout.lines.map((line) => shapedTextSizeWidthPx(line.widthPx))).toEqual(widths);
    expect(layout.heightPx).toBe(lines.length * LINE_HEIGHT_PX);
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

describe('itemIconDraw with fixed_icon_size (_adjust_to_max_size, item_list.cpp:1186-1197)', () => {
  /** A LEFT-mode icon in a 24px-tall row: the packed box sits at (h_separation / 2, 0). */
  function fittedRect(naturalSize: Vector2) {
    return itemIconDraw(true, ICON_MODE_LEFT, { x: 24, y: 24 }, naturalSize, true, { x: 100, y: 24 }, 4, 4, 4)
      .rect;
  }

  it('fits a wider-than-tall icon by width, centring vertically (happy path)', () => {
    // 32x16 into a 24x24 box: tex_width = 32*24/16 = 48 > 24, so re-derive from width:
    // tex_width=24, tex_height = 16*24/32 = 12. ofs_x=0, ofs_y=(24-12)/2=6.
    expect(fittedRect({ x: 32, y: 16 })).toEqual({ x: 2, y: 6, w: 24, h: 12 });
  });

  it('fits a taller-than-wide icon by height, centring horizontally (error path)', () => {
    // 16x32 into 24x24: tex_width = 16*24/32 = 12 <= 24, tex_height = 24.
    // ofs_x = (24-12)/2 = 6, ofs_y = 0.
    expect(fittedRect({ x: 16, y: 32 })).toEqual({ x: 2 + 6, y: 0, w: 12, h: 24 });
  });

  it('degenerates to a zero rect for a zero-size source (edge case)', () => {
    expect(fittedRect({ x: 0, y: 0 })).toEqual({ x: 2, y: 0, w: 0, h: 0 });
  });
});

describe('itemMinimumSize', () => {
  const theme = nativeTheme(1);

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
      theme
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
      theme
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
      theme
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
      theme
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

describe('itemTextDrawOffset', () => {
  it('TOP mode centres the pen at half separation past the icon offset (happy path)', () => {
    const offset = itemTextDrawOffset(
      ItemListIconMode.ICON_MODE_TOP,
      { x: 0, y: 20 },
      { x: 100, y: 50 },
      10,
      4,
      6
    );
    expect(offset).toEqual({ x: 2, y: 23 });
  });

  it('LEFT mode vertically centres the text block within the item rect (error path)', () => {
    const offset = itemTextDrawOffset(ICON_MODE_LEFT, { x: 20, y: 0 }, { x: 100, y: 50 }, 20, 4, 6);
    expect(offset).toEqual({ x: 22, y: 15 });
  });
});

describe('itemIconColor / itemTextColor', () => {
  it('the default icon modulate is opaque white, halved on disabled (happy path)', () => {
    expect(itemIconColor(false)).toEqual({ r: 1, g: 1, b: 1, a: 1 });
    expect(itemIconColor(true)).toEqual({ r: 1, g: 1, b: 1, a: 0.5 });
  });

  it('itemTextColor halves alpha only, never the RGB, on disabled (error path)', () => {
    const base = { r: 0.65, g: 0.65, b: 0.65, a: 1 };
    expect(itemTextColor(base, true)).toEqual({ r: 0.65, g: 0.65, b: 0.65, a: 0.5 });
    expect(itemTextColor(base, false)).toEqual(base);
  });
});

describe('itemListGuideLines', () => {
  // item_list.cpp:1447-1458 -- one hairline per row-packing separator, spanning
  // the panel's own content width, only outside TOP icon mode.
  it('one line per separator, spanning contentWidth, in LEFT icon mode (happy path)', () => {
    expect(itemListGuideLines(ICON_MODE_LEFT, [24, 48], 100, 0)).toEqual([
      { y: 24, width: 100, x: 0 },
      { y: 48, width: 100, x: 0 },
    ]);
  });

  it('ends before a visible vertical bar, whose width the caller takes off contentWidth (item_list.cpp:1387-1389)', () => {
    expect(itemListGuideLines(ICON_MODE_LEFT, [24], 92, 0)).toEqual([{ y: 24, width: 92, x: 0 }]);
  });

  it('starts past a visible vertical bar under RTL (item_list.cpp:1454-1455)', () => {
    expect(itemListGuideLines(ICON_MODE_LEFT, [24], 92, 8)).toEqual([{ y: 24, width: 92, x: 8 }]);
  });

  it('never draws in TOP icon mode, even with separators (error path)', () => {
    expect(itemListGuideLines(ItemListIconMode.ICON_MODE_TOP, [24, 48], 100, 0)).toEqual([]);
  });

  it('no separators means no lines (edge case)', () => {
    expect(itemListGuideLines(ICON_MODE_LEFT, [], 100, 0)).toEqual([]);
  });
});

describe('itemListDrawClip and what it keeps (item_list.cpp:1431-1441,1451,1493-1500)', () => {
  const panelOffset = { x: 4, y: 4 };
  const fits: ItemListScrollRange = { visible: false, min: 0, max: 0, page: 112 };

  it('is the control size, moved by the panel offset into the content space (happy path)', () => {
    expect(itemListDrawClip({ x: 120, y: 80 }, panelOffset, fits, true)).toEqual({
      x: -4,
      y: -4,
      w: 120,
      h: 80,
    });
  });

  it('widens by what the horizontal bar scrolls without wraparound_items (edge case)', () => {
    const scrolls: ItemListScrollRange = { visible: true, min: 0, max: 160, page: 112 };
    expect(itemListDrawClip({ x: 120, y: 80 }, panelOffset, scrolls, false).w).toBe(168);
    expect(itemListDrawClip({ x: 120, y: 80 }, panelOffset, scrolls, true).w).toBe(120);
  });

  it('keeps the rows that reach into the clip and drops the rest, a row that only touches its edge included (error path)', () => {
    const clip = { x: -4, y: -4, w: 120, h: 80 }; // content space: the list ends at y 76
    const rows = [
      { rect: { x: 0, y: 0, w: 100, h: 23 } },
      { rect: { x: 0, y: 69, w: 100, h: 23 } },
      { rect: { x: 0, y: 76, w: 100, h: 23 } },
    ];
    expect(itemListRowsInClip(rows, clip)).toEqual([rows[0], rows[1]]);
  });

  it('keeps the separators up to the clip bottom, one on it included', () => {
    const clip = { x: -4, y: -4, w: 120, h: 80 };
    expect(itemListSeparatorsInClip([23, 46, 76, 77], clip)).toEqual([23, 46, 76]);
  });
});

describe('itemListGuideColor', () => {
  // default_theme.cpp:959 -- theme->set_color("guide_color", "ItemList", Color(0.7, 0.7, 0.7, 0.25)).
  it('falls back to the built-in default absent a theme override (happy path)', () => {
    expect(itemListGuideColor({ colors: {} })).toEqual({ r: 0.7, g: 0.7, b: 0.7, a: 0.25 });
  });

  it('a theme_override_colors/guide_color (already resolved onto n.colors) wins (error path)', () => {
    const override = { r: 1, g: 0, b: 0, a: 1 };
    expect(itemListGuideColor({ colors: { guide_color: override } })).toEqual(override);
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

describe('itemListMirrorX', () => {
  // item_list.cpp:1582-1584 (icon) and :1639-1641 (wrapped text box) both
  // mirror inside `size.width`, the control's own width.
  it('leaves the LTR x untouched', () => {
    expect(itemListMirrorX(6, 16, 200, false)).toBe(6);
  });
  it('mirrors a piece inside the control own width', () => {
    expect(itemListMirrorX(6, 16, 200, true)).toBe(178);
  });
  it('leaves a full-width piece in place', () => {
    expect(itemListMirrorX(0, 200, 200, true)).toBe(0);
  });
});

describe('itemListRowTextX', () => {
  // item_list.cpp:1664-1667 with base_ofs.x 4, rect_cache (x 0, w 100),
  // icon_size.x 16, icon_margin 4, h_separation 4: text_ofs.x 22, so the
  // LTR pen sits at 26 and RTL is `200 - 100 + 16 - 26 + 4`.
  const INPUT = {
    ltrX: 26,
    itemRectWidthPx: 100,
    iconWidthPx: 16,
    controlWidthPx: 200,
    contentWidthPx: 192,
    wraparoundItems: true,
    hSeparation: 4,
  };
  it('is the LTR pen origin unchanged under LTR', () => {
    expect(itemListRowTextX({ ...INPUT }, false)).toBe(26);
  });
  it('is Godot own RTL formula, not a mirror of the LTR box', () => {
    expect(itemListRowTextX({ ...INPUT }, true)).toBe(94);
  });
  // `200 - 200 + 16 - 26 + 4` is -6, plus `MAX(200 - 192, 0)` (:1665-1667).
  it('pushes the pen right by the row overflow while wraparound_items is on', () => {
    expect(itemListRowTextX({ ...INPUT, itemRectWidthPx: 200 }, true)).toBe(2);
  });
  it('drops the overflow term with wraparound_items off', () => {
    expect(itemListRowTextX({ ...INPUT, itemRectWidthPx: 200, wraparoundItems: false }, true)).toBe(-6);
  });
});

describe('itemListLineTextWidthPx / itemListWrappedTextWidthPx', () => {
  // item_list.cpp:1657-1660: `text_w = rect.w - text_width_ofs`, shrunk by
  // the row's own overflow past `width` while wraparound_items is on.
  it('is the row width less the text pen offset', () => {
    expect(itemListLineTextWidthPx(100, 22, 192, true)).toBe(78);
  });
  it('sheds the row overflow past the content width under wraparound_items', () => {
    expect(itemListLineTextWidthPx(200, 22, 192, true)).toBe(170);
  });
  it('keeps the full row width with wraparound_items off', () => {
    expect(itemListLineTextWidthPx(200, 22, 192, false)).toBe(178);
  });
  // item_list.cpp:1629-1632: `text_w = rect.w - text_ofs.x * 2`, clamped to
  // `width - text_ofs.x` when the box would run past the content width.
  it('insets the wrapped box by the pen offset on both sides', () => {
    expect(itemListWrappedTextWidthPx(100, 2, 192, true)).toBe(96);
  });
  it('clamps the wrapped box to the content width under wraparound_items', () => {
    expect(itemListWrappedTextWidthPx(300, 2, 192, true)).toBe(190);
  });
  it('leaves the wrapped box unclamped with wraparound_items off', () => {
    expect(itemListWrappedTextWidthPx(300, 2, 192, false)).toBe(296);
  });
});

/**
 * `max_column_width` is the widest minimum width before `h_separation` joins it (`item_list.cpp:1786-1790`),
 * and `same_column_width` adds the separation once (`:1826`).
 */
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
