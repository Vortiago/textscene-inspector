/**
 * A `*_count` property has no ceiling, so nothing may walk `0..count`.
 *
 * The linter mechanised this in `reportedIndices.ts`; the render side did not,
 * and a legal `.tscn` could hang or OOM the webview and the VS Code preview
 * with no diagnostic, because the linter clears the value.
 */

import { describe, it, expect } from 'vitest';
import { parseOptionButton } from '../optionbutton/parser.js';
import { sliderTickIndices } from './slider.js';

const heading = { type: 'OptionButton', attributes: { name: 'O', type: 'OptionButton' } } as never;

describe('OptionButton item_count', () => {
  it('does not allocate a slot per index for a count no setter bounds', () => {
    // set_item_count refuses only < 0 (option_button.cpp:310).
    const parsed = parseOptionButton(heading, {
      item_count: '2000000000',
      selected: '1',
      'popup/item_0/text': '"a"',
      'popup/item_1/text': '"b"',
    });
    expect(parsed.items!.length).toBeLessThan(1000);
  });

  it('still aligns the selected index with the item it names', () => {
    const parsed = parseOptionButton(heading, {
      item_count: '2000000000',
      selected: '3',
      'popup/item_3/text': '"chosen"',
    });
    expect(parsed.items![3]!.text).toBe('chosen');
  });

  it('keeps a dense array for an ordinary count', () => {
    const parsed = parseOptionButton(heading, {
      item_count: '3',
      'popup/item_2/text': '"c"',
    });
    expect(parsed.items).toHaveLength(3);
    expect(parsed.items![0]!.text).toBe('');
  });
});

describe('Slider tick_count', () => {
  it('does not build one index per tick for a count no setter bounds', () => {
    // Slider::set_ticks has no guard at all (slider.cpp:386-393).
    // Bounded by the render cap, not by the file's number.
    expect(sliderTickIndices({ tickCount: 2000000000 } as never).length).toBeLessThanOrEqual(1024);
  });

  it('still lists every tick of an ordinary count', () => {
    expect(sliderTickIndices({ tickCount: 5 } as never)).toEqual([1, 2, 3]);
  });
});
