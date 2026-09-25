/**
 * A `*_count` property has no ceiling, so no render walk may run `0..count`: the linter clears the
 * value (`reportedIndices.ts`), and an uncapped walk hangs the webview with no diagnostic.
 */

import { describe, it, expect } from 'vitest';
import { parseOptionButton } from '../optionbutton/parser.js';
import { sliderTickIndices } from './slider.js';
import { MAX_WALKED_ELEMENTS } from './countWalk.js';

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

  it('does not allocate a slot per index for a `selected` no setter bounds', () => {
    // The bound derived from `selected` is no bound: `_select_int` returns
    // early only below NONE_SELECTED (option_button.cpp:433), so this is a
    // legal file too and only the previewer's own cap stops the walk.
    const parsed = parseOptionButton(heading, {
      item_count: '2000000000',
      selected: '1999999999',
    });
    expect(parsed.items!.length).toBeLessThanOrEqual(MAX_WALKED_ELEMENTS);
  });

  // Building 200 000 keys takes about 2 s on an idle machine and runs past the 5 s default under
  // load. The case asserts that no stack overflows, not how fast the walk is.
  it('reads the highest declared index without spreading the key set', { timeout: 30_000 }, () => {
    // `Math.max(-1, ...declared.keys())` passes one argument per index and
    // throws `RangeError: Maximum call stack size exceeded` at this size.
    const properties: Record<string, string> = { item_count: '200000' };
    for (let i = 0; i < 200_000; i++) properties[`popup/item_${i}/text`] = `"item ${i}"`;

    const parsed = parseOptionButton(heading, properties);
    expect(parsed.items).toHaveLength(MAX_WALKED_ELEMENTS);
    expect(parsed.items![0]!.text).toBe('item 0');
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
    expect(sliderTickIndices({ tickCount: 2000000000 } as never).length).toBeLessThanOrEqual(
      MAX_WALKED_ELEMENTS
    );
  });

  it('still lists every tick of an ordinary count', () => {
    expect(sliderTickIndices({ tickCount: 5 } as never)).toEqual([1, 2, 3]);
  });
});
