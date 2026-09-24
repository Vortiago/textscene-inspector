import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionButton } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

// Godot serialises OptionButton items as item_count + popup/item_N/text + popup/item_N/id, with
// `selected` an index into them (scenes/demos/2d/custom_drawing has a real example).
describe('parseOptionButton', () => {
  it('parses the popup items in order (text + numeric id), the selected index, and disabled', () => {
    const p = parseOptionButton(h({ name: 'Difficulty', type: 'OptionButton' }), {
      item_count: '3',
      'popup/item_0/text': '"Easy"',
      'popup/item_0/id': '0',
      'popup/item_1/text': '"Normal"',
      'popup/item_1/id': '1',
      'popup/item_2/text': '"Hard"',
      'popup/item_2/id': '2',
      selected: '1',
      disabled: 'true',
    });
    expect(p.selected).toBe(1);
    expect(p.items?.map((i) => i.text)).toEqual(['Easy', 'Normal', 'Hard']);
    expect(p.items?.[1]).toEqual({ text: 'Normal', id: 1 });
    expect(p.disabled).toBe(true);
  });

  it('parses `flat`, inherited from Button (button.cpp:811), defaulting to false', () => {
    expect(parseOptionButton(h({ name: 'O' }), { flat: 'true' }).flat).toBe(true);
    expect(parseOptionButton(h({ name: 'O' }), {}).flat).toBe(false);
  });

  it('defaults to no items and not-disabled when absent', () => {
    const p = parseOptionButton(h({ name: 'Empty', type: 'OptionButton' }), {});
    expect(p.items ?? []).toEqual([]);
    expect(p.disabled).toBe(false);
  });

  it('keeps items DENSE (a slot per index) when an item omits its text — so selected stays aligned', () => {
    const p = parseOptionButton(h({ name: 'Sparse', type: 'OptionButton' }), {
      item_count: '3',
      'popup/item_0/text': '"Easy"',
      'popup/item_0/id': '0',
      // item 1 omits its text key (an empty label)
      'popup/item_1/id': '1',
      'popup/item_2/text': '"Hard"',
      'popup/item_2/id': '2',
      selected: '2',
    });
    // a compacted array would drop index 1, so selected=2 would mis-resolve
    expect(p.items).toHaveLength(3);
    expect(p.items?.[1]).toEqual({ text: '', id: 1 });
    expect(p.items?.[p.selected!]?.text).toBe('Hard');
  });

  it('leaves selected undefined when the key is absent', () => {
    const p = parseOptionButton(h({ name: 'NoSel', type: 'OptionButton' }), {
      item_count: '1',
      'popup/item_0/text': '"Only"',
    });
    expect(p.selected).toBeUndefined();
  });
});

describe('a Variant int Godot reads differently from `parseInt`', () => {
  it('builds the item count the exponent spelling names', () => {
    // `parseInt` stops at the `e`, so `2e1` would build two items where Godot builds twenty.
    const p = parseOptionButton(h({ name: 'Big', type: 'OptionButton' }), {
      item_count: '2e1',
      'popup/item_19/text': '"Last"',
    });

    expect(p.items).toHaveLength(20);
    expect(p.items?.[19]?.text).toBe('Last');
  });

  it('reads an item id the same way', () => {
    const p = parseOptionButton(h({ name: 'Ids', type: 'OptionButton' }), {
      item_count: '1',
      'popup/item_0/text': '"One"',
      'popup/item_0/id': '2e1',
    });

    expect(p.items?.[0]?.id).toBe(20);
  });

  it('reads an item key spelled the way _get_property resolves it', () => {
    // The gate is `is_valid_int()` and the read is `to_int()`
    // (property_list_helper.cpp:53-55), so `item_00` and `item_+0` are item 0.
    const result = parseOptionButton(h({ name: 'Menu', type: 'OptionButton' }), {
      item_count: '1',
      'popup/item_00/text': '"Play"',
    });
    expect(result.items?.[0]?.text).toBe('Play');
  });
});
