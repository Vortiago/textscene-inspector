/** The lenient PopupMenu parse: the Window parse plus the `item_<n>/<leaf>` family (`popup_menu.cpp:3317-3328`). */
import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parsePopupMenu } from './parser';

function itemsOf(properties: Record<string, string>) {
  return parsePopupMenu(heading('PopupMenu', { name: 'Menu' }), properties).items;
}

describe('parsePopupMenu items', () => {
  it('has no item without item_count', () => {
    expect(itemsOf({ 'item_0/text': '"x"' })).toEqual([]);
  });

  it('gives each counted item the PopupMenu defaults', () => {
    expect(itemsOf({ item_count: '2' })).toEqual([
      { text: '', checkable: 0, checked: false, disabled: false, separator: false },
      { text: '', checkable: 0, checked: false, disabled: false, separator: false },
    ]);
  });

  it('reads the seven leaves of an item', () => {
    const [item] = itemsOf({
      item_count: '1',
      'item_0/text': '"Open"',
      'item_0/icon': 'ExtResource("1_abc")',
      'item_0/checkable': '2',
      'item_0/checked': 'true',
      'item_0/id': '4',
      'item_0/disabled': 'true',
      'item_0/separator': 'true',
    });
    expect(item).toEqual({
      text: 'Open',
      icon: 'ExtResource("1_abc")',
      checkable: 2,
      checked: true,
      disabled: true,
      separator: true,
    });
  });

  it('drops a line for an item at or past the count (property_list_helper.cpp:58)', () => {
    const items = itemsOf({ item_count: '1', 'item_1/text': '"late"' });
    expect(items.map((item) => item.text)).toEqual(['']);
  });

  it('leaves an item unchanged for a checkable value outside 0 to 2 (popup_menu.cpp:62-73)', () => {
    expect(itemsOf({ item_count: '1', 'item_0/checkable': '9' })[0]!.checkable).toBe(0);
  });

  it('skips a malformed leaf value and keeps the default', () => {
    const [item] = itemsOf({ item_count: '1', 'item_0/checked': 'maybe', 'item_0/text': '"ok"' });
    expect(item).toMatchObject({ text: 'ok', checked: false });
  });
});

describe('parsePopupMenu window defaults', () => {
  const props = parsePopupMenu(heading('PopupMenu', { name: 'Menu' }), {});

  it('hides, is borderless and wraps its Controls like a Popup', () => {
    expect(props).toMatchObject({ visible: false, borderless: true, wrap_controls: true });
  });

  it('is a transparent window (popup_menu.cpp:3464)', () => {
    expect(props.transparent_bg).toBe(true);
  });
});

describe('parsePopupMenu itemsAtSize', () => {
  const parse = (properties: Record<string, string>) =>
    parsePopupMenu(heading('PopupMenu', { name: 'Menu' }), properties).itemsAtSize;

  it('is null without a size line', () => {
    expect(parse({ item_count: '1' })).toBeNull();
  });

  it('is empty when the size line comes before the items', () => {
    expect(parse({ size: 'Vector2i(300, 200)', item_count: '1', 'item_0/text': '"Open"' })).toEqual([]);
  });

  it('holds every item when the size line comes after them', () => {
    const items = parse({ item_count: '1', 'item_0/text': '"Open"', size: 'Vector2i(300, 200)' });
    expect(items?.map(({ text }) => text)).toEqual(['Open']);
  });

  it('holds an item without the leaves that follow the size line', () => {
    const items = parse({ item_count: '1', size: 'Vector2i(300, 200)', 'item_0/text': '"Open"' });
    expect(items?.map(({ text }) => text)).toEqual(['']);
  });
});
