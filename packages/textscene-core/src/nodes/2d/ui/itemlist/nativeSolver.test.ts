/**
 * ItemList's minimum size versus Godot 4.6.3: `ItemList::get_minimum_size` (`scene/gui/item_list.cpp:2136-2146`)
 * over the layout of `force_update_list_size` (`:1733-1912`).
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { measureText } from '../../../../r3f/controls/native/text/measurer';
import { controlNode, solveNode, withThemeItems } from '../../../../r3f/controls/native/testing/solveNode';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { SolveContext } from '../../../../r3f/controls/native/solverRegistry';
import type { ItemListProperties } from './types';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { itemListIconSlotKey } from './nativeSolver';
import type { Vector2 } from '../../../../godot/math/vector';
import { ITEM_LIST_CASES, ITEM_LIST_SIZES, type ItemListCase } from './valueList.testkit';

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

describe('itemListMinimumSize across the value list, at each size the solve asks for', () => {
  /** Each case's minimum at (inf, inf), (200, 100) and (60, 40). */
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
      Object.entries(c.icons ?? {}).map(([index, size]) => [itemListIconSlotKey(Number(index)), size])
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
