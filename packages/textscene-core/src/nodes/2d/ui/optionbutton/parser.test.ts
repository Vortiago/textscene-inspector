import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseOptionButton } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

// Godot serializes OptionButton items as item_count + popup/item_N/text + popup/item_N/id,
// with `selected` an index into them (see scenes/demos/2d/custom_drawing for a real example).
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

  it('defaults to no items and not-disabled when absent', () => {
    const p = parseOptionButton(h({ name: 'Empty', type: 'OptionButton' }), {});
    expect(p.items ?? []).toEqual([]);
    expect(p.disabled).toBe(false);
  });
});
