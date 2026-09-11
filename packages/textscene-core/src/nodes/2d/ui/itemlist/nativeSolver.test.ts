/**
 * ItemList native solver vs Godot 4.6.3 — `ItemList::force_update_list_size`
 * (`scene/gui/item_list.cpp:1733-1912`), the per-item minsize it computes
 * inline (`:1743-1796`), `_adjust_to_max_size` (`:1186-1197`) and
 * `ItemList::get_minimum_size` (`:2136-2146`).
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { AutowrapMode } from '../../../../r3f/controls/native/text/textLayout';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext, MinimumSizeResult } from '../../../../r3f/controls/native/solverRegistry';
import type { Vec2 } from '../../../../r3f/controls/native/rect';
import type { ItemListProperties } from './types';
import {
  ICON_MODE_LEFT,
  ICON_MODE_TOP,
  adjustToMaxSize,
  itemContentMinSize,
  itemIconColor,
  itemIconPackedSize,
  itemListAutowrapMode,
  itemListLineSeparation,
  itemListMinimumSize,
  itemListSeparation,
  itemMinimumSize,
  itemTextColor,
  itemTextDrawOffset,
  itemTextLineCenterOffset,
  packItemListRows,
} from './nativeSolver';

function size(result: Vec2 | MinimumSizeResult): Vec2 {
  return 'x' in result ? result : result.size;
}

function node(props: Partial<ItemListProperties> = {}): SolveNode {
  return {
    ...solveNode(),
    path: 'IL',
    node: { name: 'IL', type: 'ItemList', children: [], properties: { name: 'IL', items: [], ...props } as ItemListProperties },
  };
}

function ctx(withMeasurer = true): SolveContext {
  return {
    theme: nativeTheme(1),
    measureText: withMeasurer ? measureText : null,
    combinedMinimumSize: () => ({ x: 0, y: 0 }),
  };
}

describe('itemListSeparation / itemListLineSeparation', () => {
  it('is round(4*scale) / round(2*scale) at scale 1 (happy path)', () => {
    expect(itemListSeparation(nativeTheme(1))).toBe(4);
    expect(itemListLineSeparation(nativeTheme(1))).toBe(2);
  });

  it('scales with the project theme scale (edge case)', () => {
    expect(itemListSeparation(nativeTheme(2))).toBe(8);
    expect(itemListLineSeparation(nativeTheme(2))).toBe(4);
  });
});

describe('itemListAutowrapMode', () => {
  it('wraps only TOP icon mode with max_text_lines > 0 (happy path)', () => {
    expect(itemListAutowrapMode(ICON_MODE_TOP, 2)).toBe(AutowrapMode.WORD);
  });

  it('never wraps LEFT icon mode, whatever max_text_lines (error path)', () => {
    expect(itemListAutowrapMode(ICON_MODE_LEFT, 2)).toBe(AutowrapMode.OFF);
  });

  it('never wraps TOP icon mode with max_text_lines <= 0 (edge case)', () => {
    expect(itemListAutowrapMode(ICON_MODE_TOP, 0)).toBe(AutowrapMode.OFF);
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

describe('adjustToMaxSize', () => {
  it('fits a wider-than-tall icon by height, centring horizontally (happy path)', () => {
    // 32x16 into a 24x24 box: tex_width = 32*24/16 = 48 > 24, so re-derive from width:
    // tex_width=24, tex_height = 16*24/32 = 12. ofs_x=0, ofs_y=(24-12)/2=6.
    expect(adjustToMaxSize({ x: 32, y: 16 }, { x: 24, y: 24 })).toEqual({ x: 0, y: 6, w: 24, h: 12 });
  });

  it('fits a taller-than-wide icon by width, centring vertically (error path)', () => {
    // 16x32 into 24x24: tex_width = 16*24/32 = 12 <= 24, tex_height = 24.
    // ofs_x = (24-12)/2 = 6, ofs_y = 0.
    expect(adjustToMaxSize({ x: 16, y: 32 }, { x: 24, y: 24 })).toEqual({ x: 6, y: 0, w: 12, h: 24 });
  });

  it('degenerates to a zero rect for a zero-size source (edge case)', () => {
    expect(adjustToMaxSize({ x: 0, y: 0 }, { x: 24, y: 24 })).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});

describe('itemContentMinSize / itemMinimumSize', () => {
  const theme = nativeTheme(1);

  it('LEFT icon mode: icon width + text width, max of the two heights (happy path)', () => {
    const content = itemContentMinSize(
      { hasIcon: true, iconSize: { x: 16, y: 16 }, hasText: true, textSize: { x: 40, y: 20 }, iconMode: ICON_MODE_LEFT, maxTextLines: 1, fixedColumnWidth: 0 },
      theme
    );
    // x = 16(icon) + 4(icon_margin) + 40(text) = 60; y = max(16, 20) = 20.
    expect(content).toEqual({ x: 60, y: 20 });
  });

  it('TOP icon mode: max of icon/text width, summed heights plus line_separation*max_text_lines (error path)', () => {
    const content = itemContentMinSize(
      { hasIcon: true, iconSize: { x: 16, y: 16 }, hasText: true, textSize: { x: 40, y: 20 }, iconMode: ICON_MODE_TOP, maxTextLines: 2, fixedColumnWidth: 0 },
      theme
    );
    // x = max(16, 40) = 40; y = 16(icon) + 4(icon_margin) + 20(text) + 2(line_separation)*2 = 44.
    expect(content).toEqual({ x: 40, y: 44 });
  });

  it('fixed_column_width overrides the computed width outright (edge case)', () => {
    const content = itemContentMinSize(
      { hasIcon: false, iconSize: { x: 0, y: 0 }, hasText: true, textSize: { x: 40, y: 20 }, iconMode: ICON_MODE_LEFT, maxTextLines: 1, fixedColumnWidth: 96 },
      theme
    );
    expect(content.x).toBe(96);
  });

  it('itemMinimumSize adds h/v separation on top of the content size', () => {
    const min = itemMinimumSize(
      { hasIcon: false, iconSize: { x: 0, y: 0 }, hasText: true, textSize: { x: 10, y: 10 }, iconMode: ICON_MODE_LEFT, maxTextLines: 1, fixedColumnWidth: 0 },
      theme
    );
    expect(min).toEqual({ x: 14, y: 14 });
  });
});

describe('packItemListRows', () => {
  const FOUR_ITEMS: Vec2[] = [
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
      wraparoundItems: true,
      autoWidth: true,
      hSeparation: 4,
      availableHeight: Number.POSITIVE_INFINITY,
    });
    // All 4 items in ONE row, unbounded by fit_size.
    expect(result.items.map((i) => i.rect.x)).toEqual([0, 20, 40, 60]);
    expect(result.contentHeight).toBe(10);
  });

  it('same_column_width stretches every item to the widest one, plus h_separation', () => {
    const result = packItemListRows({
      itemSizes: [{ x: 20, y: 10 }, { x: 30, y: 10 }],
      maxColumnWidth: 30,
      sameColumnWidth: true,
      maxColumns: 2,
      fitSize: Number.POSITIVE_INFINITY,
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
      wraparoundItems: true,
      autoWidth: false,
      hSeparation: 4,
      availableHeight: 10,
    });
    expect(result.verticalScrollbarVisible).toBe(true);
  });
});

describe('itemTextDrawOffset / itemTextLineCenterOffset', () => {
  it('TOP mode centres the pen at half separation past the icon offset (happy path)', () => {
    const offset = itemTextDrawOffset(ICON_MODE_TOP, { x: 0, y: 20 }, { x: 100, y: 50 }, 10, 4, 6);
    expect(offset).toEqual({ x: 2, y: 23 });
  });

  it('LEFT mode vertically centres the text block within the item rect (error path)', () => {
    const offset = itemTextDrawOffset(ICON_MODE_LEFT, { x: 20, y: 0 }, { x: 100, y: 50 }, 20, 4, 6);
    expect(offset).toEqual({ x: 22, y: 15 });
  });

  it('itemTextLineCenterOffset floors a wider box at zero, never negative (edge case)', () => {
    expect(itemTextLineCenterOffset(50, 80)).toBe(0);
    expect(itemTextLineCenterOffset(50, 20)).toBe(15);
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

describe('itemListMinimumSize', () => {
  it('is (0, 0) when neither auto_width nor auto_height is set (happy path)', () => {
    const result = size(itemListMinimumSize(node({ items: [{ text: 'Sword' }] }), ctx()));
    expect(result).toEqual({ x: 0, y: 0 });
  });

  it('floors auto_width against the packed content width plus the panel margin (error path)', () => {
    const n = node({ autoWidth: true, maxColumns: 1, items: [{ text: 'Sword' }] });
    const result = size(itemListMinimumSize(n, ctx()));
    expect(result.x).toBeGreaterThan(0);
    expect(result.y).toBe(0);
  });

  it('contributes zero text size when no measurer is wired, never throwing (edge case)', () => {
    const n = node({ autoWidth: true, autoHeight: true, items: [{ text: 'Sword' }] });
    expect(() => itemListMinimumSize(n, ctx(false))).not.toThrow();
  });
});
