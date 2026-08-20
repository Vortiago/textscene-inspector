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
import { ruleInt } from '../../../../godot/int.js';
import { indexedElements } from '../../../../godot/index.js';

export function parseOptionButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): OptionButtonProperties {
  const result: OptionButtonProperties = { ...parseButton(heading, properties) };

  // Build a DENSE array — one slot per index 0..item_count-1 — so `selected` (the raw
  // Godot index) aligns with items[selected] even when an item omits its text key. A
  // filtered/compacted array would shift selection past any text-less item.
  const itemCount = ruleInt(properties.item_count, 0) ?? 0;
  // Grouped by the item `_get_property` RESOLVES each key to, not by the text
  // the file spells: the gate is `is_valid_int()` and the read is `to_int()`
  // (property_list_helper.cpp:53-55), so `popup/item_00/text` and
  // `popup/item_+0/text` are item 0. Building the key forward from the counter
  // found neither and drew the item blank.
  const declared = indexedElements(properties, 'popup/item_', 'is_valid_int');
  const items: OptionItem[] = [];
  for (let i = 0; i < itemCount; i++) {
    const leaves = declared.get(i);
    const rawText = leaves?.text;
    const text = rawText !== undefined ? unquoteString(rawText) : '';
    const id = ruleInt(leaves?.id);
    items.push({ text, id: id ?? i });
  }

  if (items.length > 0) result.items = items;
  result.selected = parseOptionalInt(properties.selected);
  return result;
}
