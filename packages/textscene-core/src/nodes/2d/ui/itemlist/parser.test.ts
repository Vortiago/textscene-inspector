/** ItemList parser contract: Control base, ItemList's own members and the `item_N/*` family. */
import { describe, it, expect } from 'vitest';
import { parseItemList } from './parser';

const heading = { type: 'node', attributes: { type: 'ItemList', name: 'Inventory' } };

describe('parseItemList', () => {
  it('parses the Control base and ItemList properties (happy path)', () => {
    const result = parseItemList(heading, {
      layout_mode: '2',
      select_mode: '1',
      icon_mode: '0',
      scroll_hint_mode: '2',
      allow_reselect: 'true',
      allow_rmb_select: 'true',
      allow_search: 'false',
      auto_width: 'true',
      auto_height: 'true',
      wraparound_items: 'false',
      tile_scroll_hint: 'true',
      same_column_width: 'true',
      max_text_lines: '2',
      item_count: '1',
      max_columns: '2',
      fixed_column_width: '96',
      icon_scale: '1.5',
      fixed_icon_size: 'Vector2i(24, 24)',
      text_overrun_behavior: '1',
      'item_0/text': '"Sword"',
    });
    expect(result.name).toBe('Inventory');
    expect(result.layoutMode).toBe(2);
    expect(result.selectMode).toBe(1);
    expect(result.iconMode).toBe(0);
    expect(result.scrollHintMode).toBe(2);
    expect(result.allowReselect).toBe(true);
    expect(result.allowRmbSelect).toBe(true);
    expect(result.allowSearch).toBe(false);
    expect(result.autoWidth).toBe(true);
    expect(result.autoHeight).toBe(true);
    expect(result.wraparoundItems).toBe(false);
    expect(result.tileScrollHint).toBe(true);
    expect(result.sameColumnWidth).toBe(true);
    expect(result.maxTextLines).toBe(2);
    expect(result.itemCount).toBe(1);
    expect(result.maxColumns).toBe(2);
    expect(result.fixedColumnWidth).toBe(96);
    expect(result.iconScale).toBe(1.5);
    expect(result.fixedIconSize).toEqual({ x: 24, y: 24 });
    expect(result.textOverrunBehavior).toBe(1);
    expect(result.items).toEqual([{ text: 'Sword' }]);
  });

  it('drops an item_N/* write past item_count, matching the ERR_FAIL_INDEX drop (error path)', () => {
    const result = parseItemList(heading, {
      item_count: '1',
      'item_0/text': '"Sword"',
      'item_1/text': '"Shield"',
    });
    expect(result.items).toEqual([{ text: 'Sword' }]);
  });

  it('handles a bare node with no properties at all (edge case)', () => {
    const result = parseItemList({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.items).toEqual([]);
    expect(result.iconMode).toBeUndefined();
  });

  it('builds a dense array capturing icon/selectable/disabled leaves per row', () => {
    const result = parseItemList(heading, {
      item_count: '3',
      'item_0/text': '"Sword"',
      'item_0/icon': 'ExtResource("1_icon")',
      'item_1/text': '"Shield"',
      'item_1/selectable': 'false',
      'item_2/text': '"Potion"',
      'item_2/disabled': 'true',
    });
    expect(result.items).toEqual([
      { text: 'Sword', icon: 'ExtResource("1_icon")' },
      { text: 'Shield', selectable: false },
      { text: 'Potion', disabled: true },
    ]);
  });

  // item_list.cpp:2242-2259 -- the deprecated `items = [text, icon, disabled, …]`
  // triple array, only when the file has no `item_count` at all.
  describe('the deprecated items compat array', () => {
    it('reads text/icon/disabled triples, absent item_count (happy path)', () => {
      const result = parseItemList(heading, {
        items: '["Sword", ExtResource("1_icon"), false, "Shield", null, true]',
      });
      expect(result.items).toEqual([
        { text: 'Sword', icon: 'ExtResource("1_icon")' },
        { text: 'Shield', disabled: true },
      ]);
      expect(result.itemCount).toBe(2);
    });

    it('a wrong arity drops every row, matching ERR_FAIL_COND_V before clear() (error path)', () => {
      const result = parseItemList(heading, { items: '["Sword", null]' });
      expect(result.items).toEqual([]);
      expect(result.itemCount).toBeUndefined();
    });

    it('modern item_N/* wins outright once item_count is present, even alongside items (edge case)', () => {
      const result = parseItemList(heading, {
        item_count: '1',
        'item_0/text': '"Sword"',
        items: '["Stale", null, false]',
      });
      expect(result.items).toEqual([{ text: 'Sword' }]);
    });
  });
});
