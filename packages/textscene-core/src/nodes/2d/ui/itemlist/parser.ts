/** ItemList parser — Control base, ItemList's own members, and the `item_N/*` row family. */

import { type ParsedHeading, unquoteString } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalFloat, parseOptionalInt, parseOptionalVector2i } from '../../../../parser/valueParsers';
import { parseControl } from '../control/parser';
import { indexedElements, ruleCount, boolSlotValue } from '../../../../godot/index.js';
import { MAX_WALKED_ELEMENTS } from '../shared/countWalk';
import type { ItemListItem, ItemListProperties } from './types';

/**
 * `item_N/*` (`PropertyListHelper`, `item_list.cpp:2461-2467`), restricted to
 * `N < item_count`: `ItemList::_set` routes to `property_helper.property_set_value`,
 * whose setters all open with `ERR_FAIL_INDEX(p_idx, items.size())`
 * (e.g. `set_item_text`, `item_list.cpp:93`) — a `.tscn` authoring an index
 * past the array `set_item_count` allocated is a DROPPED write, never an
 * implicit grow, so this builds exactly `itemCount` slots and never more.
 */
function parseItems(properties: Record<string, string>, itemCount: number): ItemListItem[] {
  const count = Math.min(itemCount, MAX_WALKED_ELEMENTS);
  if (count <= 0) return [];
  const declared = indexedElements(properties, 'item_', 'is_valid_int');
  const items: ItemListItem[] = [];
  for (let i = 0; i < count; i++) {
    const leaves = declared.get(i);
    const item: ItemListItem = {};
    const rawText = leaves?.get('text');
    if (rawText !== undefined) item.text = unquoteString(rawText);
    const rawIcon = leaves?.get('icon');
    if (rawIcon !== undefined) item.icon = rawIcon;
    const rawSelectable = leaves?.get('selectable');
    if (rawSelectable !== undefined) item.selectable = boolSlotValue(rawSelectable) === true;
    const rawDisabled = leaves?.get('disabled');
    if (rawDisabled !== undefined) item.disabled = boolSlotValue(rawDisabled) === true;
    items.push(item);
  }
  return items;
}

export function parseItemList(
  heading: ParsedHeading,
  properties: Record<string, string>
): ItemListProperties {
  const itemCount = ruleCount(properties.item_count) ?? 0;
  return {
    ...parseControl(heading, properties),
    selectMode: parseOptionalInt(properties.select_mode),
    iconMode: parseOptionalInt(properties.icon_mode),
    scrollHintMode: parseOptionalInt(properties.scroll_hint_mode),
    allowReselect: parseOptionalBool(properties.allow_reselect),
    allowRmbSelect: parseOptionalBool(properties.allow_rmb_select),
    allowSearch: parseOptionalBool(properties.allow_search),
    autoWidth: parseOptionalBool(properties.auto_width),
    autoHeight: parseOptionalBool(properties.auto_height),
    wraparoundItems: parseOptionalBool(properties.wraparound_items),
    tileScrollHint: parseOptionalBool(properties.tile_scroll_hint),
    sameColumnWidth: parseOptionalBool(properties.same_column_width),
    maxTextLines: parseOptionalInt(properties.max_text_lines),
    itemCount: parseOptionalInt(properties.item_count),
    maxColumns: parseOptionalInt(properties.max_columns),
    fixedColumnWidth: parseOptionalInt(properties.fixed_column_width),
    iconScale: parseOptionalFloat(properties.icon_scale),
    fixedIconSize: parseOptionalVector2i(properties.fixed_icon_size, 'fixed_icon_size'),
    textOverrunBehavior: parseOptionalInt(properties.text_overrun_behavior),
    items: parseItems(properties, itemCount),
  };
}
