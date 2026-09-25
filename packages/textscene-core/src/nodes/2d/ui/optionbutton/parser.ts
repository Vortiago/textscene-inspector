/**
 * Parses an OptionButton through `parseButton`, since an OptionButton is a Button in Godot, plus the
 * `popup/item_N/...` items and `selected`. The renderer ignores `text`: `_select` overwrites it from the
 * chosen item (option_button.cpp:423), so `Component.tsx` reads the selected item's label.
 */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { OptionItem, OptionButtonProperties } from './types';
import { parseButton } from '../button/parser';
import { ruleCount, ruleInt } from '../../../../godot/int.js';
import { indexedElements } from '../../../../godot/index.js';
import { MAX_WALKED_ELEMENTS } from '../shared/countWalk';

export function parseOptionButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): OptionButtonProperties {
  const result: OptionButtonProperties = { ...parseButton(heading, properties) };

  // A dense array, one slot per index, so `selected`, the raw Godot index, aligns with items[selected]
  // even when an item omits its text key.
  const itemCount = ruleCount(properties.item_count) ?? 0;
  // Read before the item walk, which bounds itself on it.
  result.selected = parseOptionalInt(properties.selected);
  // Grouped by the item `_get_property` resolves each key to: the gate is `is_valid_int()` and the read is
  // `to_int()` (property_list_helper.cpp:53-55), so `popup/item_00/text` and `popup/item_+0/text` are item 0.
  const declared = indexedElements(properties, 'popup/item_', 'is_valid_int');
  // Dense only as far as anything observes: past the last index the file names or `selected` points at,
  // an item renders blank either way. A loop, not `Math.max(-1, ...declared.keys())`: the spread passes
  // one argument per index, and 10^5 keys throw `RangeError: Maximum call stack size exceeded`.
  let observed = -1;
  for (const index of declared.keys()) if (index > observed) observed = index;
  const selected = result.selected;
  if (selected !== undefined && selected > observed) observed = selected;
  // `selected` is an unbounded INT slot: `_select_int` returns early only below NONE_SELECTED
  // (option_button.cpp:433), so it bounds nothing. Past MAX_WALKED_ELEMENTS (countWalk.ts) `items[selected]`
  // is undefined, and the component draws the empty text of any out-of-range `selected`.
  const slots = Math.min(itemCount, observed + 1, MAX_WALKED_ELEMENTS);
  const items: OptionItem[] = [];
  for (let i = 0; i < slots; i++) {
    const leaves = declared.get(i);
    const rawText = leaves?.get('text');
    const text = rawText !== undefined ? unquoteString(rawText) : '';
    const id = ruleInt(leaves?.get('id'));
    items.push({ text, id: id ?? i });
  }

  if (items.length > 0) result.items = items;
  return result;
}
