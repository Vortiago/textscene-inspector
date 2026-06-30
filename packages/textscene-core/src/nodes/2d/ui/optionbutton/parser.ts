/** OptionButton parser — Control + items array (popup/item_N/…) + selected/disabled flags. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { OptionItem, OptionButtonProperties } from './types';
import { parseControl } from '../control/parser';

export function parseOptionButton(
  heading: ParsedHeading,
  properties: Record<string, string>
): OptionButtonProperties {
  const result: OptionButtonProperties = { ...parseControl(heading, properties) };

  // Build a DENSE array — one slot per index 0..item_count-1 — so `selected` (the raw
  // Godot index) aligns with items[selected] even when an item omits its text key. A
  // filtered/compacted array would shift selection past any text-less item.
  const itemCount = parseInt(properties.item_count || '0', 10);
  const items: OptionItem[] = [];
  for (let i = 0; i < itemCount; i++) {
    const rawText = properties[`popup/item_${i}/text`];
    const text = rawText !== undefined ? unquoteString(rawText) : '';
    const id = parseInt(properties[`popup/item_${i}/id`] ?? String(i), 10);
    items.push({ text, id: Number.isNaN(id) ? i : id });
  }

  if (items.length > 0) result.items = items;
  result.selected = parseOptionalInt(properties.selected);
  result.disabled = properties.disabled === 'true';
  return result;
}
