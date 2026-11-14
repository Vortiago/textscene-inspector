/**
 * ItemList's draw geometry versus Godot 4.6.3: `NOTIFICATION_DRAW` (`scene/gui/item_list.cpp:1367-1729`)
 * and `_adjust_to_max_size` (`:1186-1197`).
 */
import {} from '../../../../godot/scene/defaultTheme/defaultTheme';
import {} from '../../../../r3f/controls/native/defaultThemeRecords';
import { describe, expect, it } from 'vitest';
import {} from '../../../../r3f/controls/native/nativeTheme';
import {} from '../../../../r3f/controls/native/text/measurer';
import {} from '../../../../r3f/controls/native/text/openSansFontMetrics';
import type {} from '../../../../r3f/controls/native/solveTree';
import type {} from '../../../../r3f/controls/native/solverRegistry';
import type {} from './types';
import {} from '../../../../r3f/controls/native/solverRegistry';
import { ICON_MODE_LEFT } from './nativeSolver';
import {
  itemIconColor,
  itemIconDraw,
  itemListDrawClip,
  itemListGuideLines,
  itemListRowsInClip,
  itemListCursorRect,
  itemListSelectedRect,
  itemListSeparatorsInClip,
  itemListRowTextX,
  itemListLineTextWidthPx,
  itemListWrappedTextWidthPx,
  itemTextColor,
  itemTextDrawOffset,
} from './itemListDraw';
import {} from './mirrorX';
import { ItemListIconMode } from '../../../../godot/scene/gui';
import type { Vector2 } from '../../../../godot/math/vector';
import type { ItemListScrollRange } from './nativeSolver';
import {} from '../../../../r3f/controls/native/text/textLayout';
import {} from '../../../../r3f/controls/native/text/textLayout.testkit';

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

describe('itemTextDrawOffset', () => {
  it('wrapped text centres the pen at half separation past the icon offset (happy path)', () => {
    const offset = itemTextDrawOffset(true, { x: 0, y: 20 }, { x: 100, y: 50 }, 10, 4, 6);
    expect(offset).toEqual({ x: 2, y: 23 });
  });

  it('a single line vertically centres the text block within the item rect (error path)', () => {
    const offset = itemTextDrawOffset(false, { x: 20, y: 0 }, { x: 100, y: 50 }, 20, 4, 6);
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
  // item_list.cpp:1447-1458: one hairline per row-packing separator, spanning the panel's own
  // content width, only outside TOP icon mode. Each quad starts half a pixel above its separator.
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
describe('itemListSelectedRect (item_list.cpp:1502-1517)', () => {
  const input = {
    rowRect: { x: 0, y: 20, w: 50, h: 18 },
    baseX: 4,
    columnCount: 1,
    contentWidth: 200,
    controlWidth: 208,
    panelMarginLeft: 4,
    panelMarginRight: 4,
    rtl: false,
  };

  it('runs a one-column row to the right edge of the content', () => {
    expect(itemListSelectedRect(input)).toEqual({ x: 0, y: 0, w: 200, h: 18 });
  });

  it('keeps the width of a row in a list of several columns', () => {
    expect(itemListSelectedRect({ ...input, columnCount: 3 }).w).toBe(50);
  });

  it('mirrors inside the control under RTL', () => {
    const rowRect = { x: 10, y: 20, w: 50, h: 18 };
    expect(itemListSelectedRect({ ...input, rowRect, rtl: true })).toEqual({ x: -10, y: 0, w: 190, h: 18 });
  });
});

describe('itemListCursorRect (item_list.cpp:1486-1495,1698-1705)', () => {
  const input = {
    rowRect: { x: 10, y: 20, w: 50, h: 18 },
    baseX: 4,
    columnCount: 1,
    contentWidth: 200,
    controlWidth: 208,
    rtl: false,
  };

  it('runs a one-column row to the right edge of the content', () => {
    expect(itemListCursorRect(input)).toEqual({ x: 0, y: 0, w: 190, h: 18 });
  });

  it('mirrors inside the control under RTL without the panel margins', () => {
    expect(itemListCursorRect({ ...input, rtl: true })).toEqual({ x: -10, y: 0, w: 190, h: 18 });
  });
});
