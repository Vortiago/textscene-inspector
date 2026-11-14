/**
 * ItemList scrollbar and scroll hint placement versus Godot 4.6.3: the anchors of
 * `item_list.cpp:1370-1379` and the hint of `:1708-1720`. The expected rects come from a Godot render:
 * a 120x80 list, default theme, 4 px panel margins, 8 px bars.
 */
import { describe, expect, it } from 'vitest';
import { defaultScrollBarBoxes } from '../shared/testing/scrollBarBoxes';
import { ItemListScrollHintMode } from '../../../../godot/scene/gui';
import { itemListScrollBars } from './scrollBars';
import type { ItemListScrollRange } from './itemListPack';

const MARGINS = { left: 4, top: 4, right: 4, bottom: 4 };
const HIDDEN: ItemListScrollRange = { visible: false, min: 0, max: 72, page: 72 };
const OVERFLOWING_ROWS: ItemListScrollRange = { visible: true, min: 0, max: 138, page: 72 };
const WIDE_ROWS: ItemListScrollRange = { visible: true, min: 0, max: 160, page: 112 };

function scrollBars(overrides: Partial<Parameters<typeof itemListScrollBars>[0]>) {
  return itemListScrollBars({
    size: { x: 120, y: 80 },
    margins: MARGINS,
    vertical: HIDDEN,
    horizontal: HIDDEN,
    rtl: false,
    boxes: defaultScrollBarBoxes(1),
    scrollHintMode: ItemListScrollHintMode.SCROLL_HINT_MODE_DISABLED,
    ...overrides,
  });
}

describe('itemListScrollBars: vertical bar', () => {
  it('anchors to the right margin, from the top margin to the bottom margin (item_list.cpp:1373-1376)', () => {
    const { vertical } = scrollBars({ vertical: OVERFLOWING_ROWS });
    expect(vertical.visible).toBe(true);
    // Godot measured x 116-123, y 12-83.
    expect(vertical.rect).toEqual({ x: 108, y: 4, w: 8, h: 72 });
  });

  it('puts the grabber at the top, sized by page over max (scroll_bar.cpp:479-488)', () => {
    const { vertical } = scrollBars({ vertical: OVERFLOWING_ROWS });
    expect(vertical.grabberRect.x).toBe(0);
    expect(vertical.grabberRect.y).toBe(0);
    expect(vertical.grabberRect.w).toBe(8);
    expect(vertical.grabberRect.h).toBeGreaterThan(0);
    expect(vertical.grabberRect.h).toBeLessThan(vertical.rect.h);
  });

  it('is hidden while the rows fit', () => {
    expect(scrollBars({}).vertical.visible).toBe(false);
  });

  it('moves to the left edge under RTL, past the panel margin (control.cpp:1785-1787)', () => {
    const { vertical } = scrollBars({
      vertical: OVERFLOWING_ROWS,
      rtl: true,
      margins: { ...MARGINS, left: 6 },
    });
    expect(vertical.rect.x).toBe(6);
  });
});

describe('itemListScrollBars: horizontal bar', () => {
  it('sits above the bottom margin and stops short of a visible vertical bar (item_list.cpp:1377-1379)', () => {
    const { horizontal } = scrollBars({ horizontal: WIDE_ROWS });
    // Godot measured x 268-379 in a 120 px list at 264: x 4 to 115, y 68 to 75 in list space.
    expect(horizontal.rect).toEqual({ x: 4, y: 68, w: 112, h: 8 });
    const both = scrollBars({ horizontal: WIDE_ROWS, vertical: OVERFLOWING_ROWS });
    expect(both.horizontal.rect.w).toBe(104);
    expect(both.vertical.rect.h).toBe(64);
  });

  it('starts the grabber at the left, sized by page over max', () => {
    const { horizontal } = scrollBars({ horizontal: WIDE_ROWS });
    expect(horizontal.grabberRect.x).toBe(0);
    expect(horizontal.grabberRect.h).toBe(8);
  });

  it('puts the grabber at the far end under RTL, where the mirrored range keeps value 0 (item_list.cpp:1891-1893)', () => {
    const mirrored: ItemListScrollRange = { visible: true, min: -48, max: 112, page: 112 };
    const { horizontal } = scrollBars({ horizontal: mirrored, rtl: true });
    expect(horizontal.grabberRect.x + horizontal.grabberRect.w).toBeCloseTo(horizontal.rect.w, 5);
  });
});

describe('itemListScrollBars: bottom scroll hint', () => {
  const both = ItemListScrollHintMode.SCROLL_HINT_MODE_BOTH;

  it('is a flipped 24 px fade across the full control width (item_list.cpp:1718)', () => {
    const { bottomHint } = scrollBars({ vertical: OVERFLOWING_ROWS, scrollHintMode: both });
    expect(bottomHint).toEqual({
      rect: { x: 0, y: 56, w: 120, h: 24 },
      vertical: true,
      flipH: false,
      flipV: true,
    });
  });

  it('draws for BOTTOM too, and not for TOP or DISABLED (the top hint needs a scroll value above 1)', () => {
    const hintFor = (mode: number) =>
      scrollBars({ vertical: OVERFLOWING_ROWS, scrollHintMode: mode }).bottomHint;
    expect(hintFor(ItemListScrollHintMode.SCROLL_HINT_MODE_BOTTOM)).not.toBeNull();
    expect(hintFor(ItemListScrollHintMode.SCROLL_HINT_MODE_TOP)).toBeNull();
    expect(hintFor(ItemListScrollHintMode.SCROLL_HINT_MODE_DISABLED)).toBeNull();
  });

  it('needs content more than 1 px past the page (item_list.cpp:1710)', () => {
    const justOver: ItemListScrollRange = { visible: true, min: 0, max: 73, page: 72 };
    expect(scrollBars({ vertical: justOver, scrollHintMode: both }).bottomHint).toBeNull();
    expect(scrollBars({ vertical: HIDDEN, scrollHintMode: both }).bottomHint).toBeNull();
  });
});
