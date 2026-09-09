/**
 * OptionButton parser: Button + items array (popup/item_N/…) + selected.
 *
 * Chains through `parseButton`, not `parseControl`: an OptionButton IS a Button in
 * Godot, so `flat`, `alignment`, `icon` and the icon-alignment trio are live
 * properties a scene can carry. Reading only Control's set dropped them, and
 * re-derived `disabled` by hand from the one line `parseButton` already had.
 *
 * `text` and `icon` come through too, and the renderer deliberately ignores
 * `text`: Godot's `_select` overwrites it from the chosen item
 * (option_button.cpp:423), so the selected item's label is the real source and
 * `Component.tsx` reads that instead.
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

  // Build a DENSE array — one slot per index 0..item_count-1 — so `selected` (the raw
  // Godot index) aligns with items[selected] even when an item omits its text key. A
  // filtered/compacted array would shift selection past any text-less item.
  const itemCount = ruleCount(properties.item_count) ?? 0;
  // Read before the item walk, which bounds itself on it.
  result.selected = parseOptionalInt(properties.selected);
  // Grouped by the item `_get_property` RESOLVES each key to, not by the text
  // the file spells: the gate is `is_valid_int()` and the read is `to_int()`
  // (property_list_helper.cpp:53-55), so `popup/item_00/text` and
  // `popup/item_+0/text` are item 0. Building the key forward from the counter
  // found neither and drew the item blank.
  const declared = indexedElements(properties, 'popup/item_', 'is_valid_int');
  // Dense only as far as anything can OBSERVE. Nothing past the last index the
  // file NAMES or `selected` points at differs from an absent item: it renders
  // blank either way, and the component reads `items[selected]` alone. So the
  // alignment `selected` needs is preserved, and the tail that carried no
  // information is not built.
  //
  // A loop, not `Math.max(-1, ...declared.keys())`: the spread passes one
  // ARGUMENT per declared index, and ~10^5 `popup/item_N/*` keys throw
  // `RangeError: Maximum call stack size exceeded` out of the lenient parser.
  let observed = -1;
  for (const index of declared.keys()) if (index > observed) observed = index;
  const selected = result.selected;
  if (selected !== undefined && selected > observed) observed = selected;
  // `selected` is itself an unbounded INT slot — `_select_int` returns early
  // only below NONE_SELECTED (option_button.cpp:433) — so a bound derived from
  // it is no bound at all. The previewer's own cap is (countWalk.ts); past it
  // `items[selected]` is undefined and the component draws the empty text it
  // already draws for an out-of-range `selected`.
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
