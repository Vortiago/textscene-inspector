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

  const itemCount = parseInt(properties.item_count || '0', 10);
  const items: OptionItem[] = [];
  for (let i = 0; i < itemCount; i++) {
    const rawText = properties[`popup/item_${i}/text`];
    if (rawText !== undefined) {
      const text = unquoteString(rawText);
      const id = parseInt(properties[`popup/item_${i}/id`] ?? String(i), 10);
      items.push({ text, id: Number.isNaN(id) ? i : id });
    }
  }

  if (items.length > 0) result.items = items;
  result.selected = parseOptionalInt(properties.selected);
  result.disabled = properties.disabled === 'true';
  return result;
}
