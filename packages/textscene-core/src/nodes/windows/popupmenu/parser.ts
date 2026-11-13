/** The lenient parse of a PopupMenu: the Window parse plus its items (`popup_menu.cpp:3317-3328`). */

import type { OverrideLayer } from '../../../core/NodeRegistry';
import type { ParsedHeading } from '../../../parser/utils';
import { unquoteString } from '../../../parser/utils';
import { boolOr, intOr } from '../../../parser/valueParsers';
import { indexedElements } from '../../../godot/classdb/indexedKey';
import { POPUP_MENU_ITEMS } from '../../../godot/classdb/propertyListFamilies';
import { ITEM_CHECKABLE_TYPE_NAMES, ItemCheckableType } from '../../../godot/scene/popupMenu';
import { holdsResource } from '../../../godot/scene/resourceLiteral';
import { slotCount } from '../../../godot/variant/intSlots';
import { MAX_WALKED_ELEMENTS } from '../../2d/ui/shared/countWalk';
import { parseWindow } from '../window/parser';
import type { PopupMenuItem, PopupMenuProperties } from './types';

/**
 * The first `item_count` items. Each leaf setter opens with `ERR_FAIL_INDEX`, so a line past the count
 * is dropped, never a grow (`property_list_helper.cpp:58`).
 */
function parseItems(properties: Record<string, string>, context: string): PopupMenuItem[] {
  const count = Math.min(slotCount(properties[POPUP_MENU_ITEMS.countKey.key]) ?? 0, MAX_WALKED_ELEMENTS);
  const declared = indexedElements(properties, POPUP_MENU_ITEMS.prefix, POPUP_MENU_ITEMS.indexParse);
  const items: PopupMenuItem[] = [];
  for (let index = 0; index < count; index++) {
    const leaves = declared.get(index);
    const at = `${context}.item_${index}`;
    const icon = leaves?.get('icon');
    // A value outside the enum is a dropped write (`_set_item_checkable_type`, `popup_menu.cpp:62-73`).
    const checkable = intOr(leaves?.get('checkable'), ItemCheckableType.NONE, `${at}/checkable`);
    items.push({
      text: unquoteString(leaves?.get('text') ?? '""'),
      ...(holdsResource(icon) ? { icon } : {}),
      checkable: checkable in ITEM_CHECKABLE_TYPE_NAMES ? checkable : ItemCheckableType.NONE,
      checked: boolOr(leaves?.get('checked'), false, `${at}/checked`),
      disabled: boolOr(leaves?.get('disabled'), false, `${at}/disabled`),
      separator: boolOr(leaves?.get('separator'), false, `${at}/separator`),
    });
  }
  return items;
}

/** Whether `key` is one of the keys the items come from. */
function isItemKey(key: string): boolean {
  return key === POPUP_MENU_ITEMS.countKey.key || key.startsWith(POPUP_MENU_ITEMS.prefix);
}

/**
 * The items as they stand when the `size` line runs, or `null` when the scene has none. The same array
 * as `items` when no item key follows `size`, so the layout shapes the items once.
 */
function parseItemsAtSize(
  properties: Record<string, string>,
  items: PopupMenuItem[],
  context: string
): PopupMenuItem[] | null {
  const keys = Object.keys(properties);
  const sizeAt = keys.indexOf('size');
  if (sizeAt < 0) return null;
  if (!keys.slice(sizeAt + 1).some(isItemKey)) return items;
  const beforeSize = Object.fromEntries(keys.slice(0, sizeAt).map((key) => [key, properties[key]!]));
  return parseItems(beforeSize, context);
}

export function parsePopupMenu(
  heading: ParsedHeading,
  properties: Record<string, string>,
  override?: OverrideLayer<PopupMenuProperties>
): PopupMenuProperties {
  const window = parseWindow(heading, properties, override);
  const items = parseItems(properties, window.name);
  return { ...window, items, itemsAtSize: parseItemsAtSize(properties, items, window.name) };
}
