/**
 * Where `_draw_items` puts each part of a row (`popup_menu.cpp:847-1085`), at the default theme
 * scale: a check gutter of 16 + 4, a start padding of 2, a gap of 4 and 23 px item rows.
 */
import { describe, expect, it } from 'vitest';
import { nativeTheme } from '../../../r3f/controls/native/nativeTheme';
import type { SolveNode } from '../../../r3f/controls/native/solveTree';
import { measureText } from '../../../r3f/controls/native/text/measurer';
import '../../../r3f/controls/index';
import { wrappedWindowSize } from '../window/wrapControls';
import { popupMenuDrawing } from './menuDrawing';
import { menuModel, popupMenuGeometry } from './menuLayout';
import { menu, text, type ItemLines } from './testing/menuNode';

const THEME = nativeTheme(1);
const EMBEDDER = { x: 1152, y: 648 };
const CHECK_SIZE = 16;
const ROW_HEIGHT = 23;

function drawingOf(window: SolveNode) {
  const size = wrappedWindowSize(window, THEME, measureText, EMBEDDER);
  const model = menuModel(window, { theme: THEME, measureText });
  const geometry = popupMenuGeometry(window, size, model);
  const rows = popupMenuDrawing(window, model.menu, geometry.rows, geometry.control.w, geometry.scroll.h);
  return { rows, geometry, width: geometry.control.w };
}

const checkItems: ItemLines[] = [{ text: 'Open' }, { text: 'Auto', checkable: 1, checked: true }];

describe('the text start', () => {
  it('follows the start padding and the check gutter', () => {
    const { rows } = drawingOf(menu(checkItems));
    expect(rows[0]!.text!.position.x).toBe(2 + CHECK_SIZE + 4);
  });

  it('keeps only the gap where no item is checkable', () => {
    const { rows } = drawingOf(menu(text('Open', 'Save')));
    expect(rows[0]!.text!.position.x).toBe(2 + 4);
  });

  it('follows the icon column and then the check column in a split gutter', () => {
    const items = [{ text: 'Open', icon: { x: 12, y: 12 } }, ...checkItems.slice(1)];
    const { rows } = drawingOf({ ...menu(items), constants: { gutter_compact: 0 } });
    expect(rows[0]!.text!.position.x).toBe(2 + 12 + 4 + CHECK_SIZE + 4);
  });
});

describe('the check mark', () => {
  it('sits at the start padding, centred in its row', () => {
    const { rows, geometry } = drawingOf(menu(checkItems));
    const rowY = geometry.rows[1]!.y;
    expect(rows[1]!.check!.position).toEqual({ x: 2, y: rowY + Math.floor((ROW_HEIGHT - CHECK_SIZE) / 2) });
  });

  it('picks the radio icon for a radio item and the disabled one for a disabled item', () => {
    const items = [{ text: 'A', checkable: 2, checked: true, disabled: true }];
    expect(drawingOf(menu(items)).rows[0]!.check!.key).toBe('radioCheckedDisabled');
  });
});

describe('right-to-left layout', () => {
  it('mirrors the check mark and the text from the right edge', () => {
    const { rows, width } = drawingOf(menu(checkItems, {}, true));
    expect(rows[1]!.check!.position.x).toBe(width - 2 - CHECK_SIZE);
    const label = rows[1]!.text!;
    expect(label.position.x + label.layout.widthPx).toBeLessThanOrEqual(width - 2 - CHECK_SIZE - 4);
  });
});

describe('a separator', () => {
  it('hands its line the whole row width and no height, as the line box grows it itself', () => {
    const { rows, geometry, width } = drawingOf(menu([...text('A'), { separator: true }]));
    const [line] = rows[1]!.separators;
    expect(line!.rect).toEqual({ x: 0, y: geometry.rows[1]!.y, w: width, h: 0 });
  });

  it('splits into two lines around its label', () => {
    const items: ItemLines[] = [{ text: 'Group', separator: true }, ...text('A')];
    const { rows, geometry, width } = drawingOf(menu(items));
    const { textSize } = geometry.rows[0]!.entry;
    const half = Math.trunc((textSize.x + 4 * 2) / 2);
    const [left, right] = rows[0]!.separators;
    expect(left!.rect.w).toBe(Math.trunc(width / 2) - half);
    expect(right!.rect.x).toBe(Math.trunc(width / 2) + half);
  });

  it('centres its label with the icon in front, and the icon follows it in right-to-left layout', () => {
    const items: ItemLines[] = [{ text: 'Group', icon: { x: 8, y: 8 }, separator: true }];
    const ltr = drawingOf(menu(items));
    const rtl = drawingOf(menu(items, {}, true));
    const { textSize } = ltr.geometry.rows[0]!.entry;
    const centred = Math.trunc(Math.trunc((ltr.width - textSize.x) / 2) - (8 + 4) / 2);
    expect(ltr.rows[0]!.icon!.rect.x).toBe(centred);
    expect(ltr.rows[0]!.text!.position.x).toBe(centred + 8 + 4);
    expect(rtl.rows[0]!.text!.position.x).toBe(centred);
    expect(rtl.rows[0]!.icon!.rect.x).toBe(rtl.width - centred - 8);
  });
});

describe('a disabled item', () => {
  it('takes the disabled font colour', () => {
    const { rows } = drawingOf(menu([{ text: 'Quit', disabled: true }]));
    expect(rows[0]!.text!.color).toEqual({ r: 0.4, g: 0.4, b: 0.4, a: 0.8 });
  });
});

describe('the text outline', () => {
  const RED = { r: 1, g: 0, b: 0, a: 1 };
  const GREEN = { r: 0, g: 1, b: 0, a: 1 };
  const themed = (window: SolveNode): SolveNode => ({
    ...window,
    constants: { outline_size: 4, separator_outline_size: 3 },
    colors: { font_outline_color: RED, font_separator_outline_color: GREEN },
  });

  it('draws no ring by default: the default theme sets the outline size to 0', () => {
    const { rows } = drawingOf(menu(text('Open')));
    expect(rows[0]!.text!.outline.sizePx).toBe(0);
  });

  it('gives an item label the item outline (`popup_menu.cpp:1016-1017`)', () => {
    const { rows } = drawingOf(themed(menu(text('Open'))));
    expect(rows[0]!.text!.outline).toEqual({ color: RED, sizePx: 4 });
  });

  it('gives a separator label its own outline (`popup_menu.cpp:998-999`)', () => {
    const { rows } = drawingOf(themed(menu([{ text: 'Group', separator: true }])));
    expect(rows[0]!.text!.outline).toEqual({ color: GREEN, sizePx: 3 });
  });
});
