/** The lenient parse of a PopupMenu: the Window parse plus its items (`popup_menu.cpp:3317-3328`). */

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

/** The properties a scene sets before its `size` line, in file order (`null` when it has none). */
function propertiesBeforeSize(properties: Record<string, string>): Record<string, string> | null {
  const keys = Object.keys(properties);
  const sizeAt = keys.indexOf('size');
  if (sizeAt < 0) return null;
  return Object.fromEntries(keys.slice(0, sizeAt).map((key) => [key, properties[key]!]));
}

export function parsePopupMenu(
  heading: ParsedHeading,
  properties: Record<string, string>
): PopupMenuProperties {
  const window = parseWindow(heading, properties);
  const beforeSize = propertiesBeforeSize(properties);
  const items = parseItems(properties, window.name);
  const itemsAtSize = beforeSize && parseItems(beforeSize, window.name);
  // The same array when the size line follows every item, so the layout shapes the items once.
  const isSameItems = itemsAtSize !== null && JSON.stringify(itemsAtSize) === JSON.stringify(items);
  return { ...window, items, itemsAtSize: isSameItems ? items : itemsAtSize };
}
