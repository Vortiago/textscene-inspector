/** PopupMenu's item facts, which MenuButton reaches too. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/**
 * `PopupMenu`'s per-item checkable type, reached by `MenuButton` too, which
 * forwards its item writes to PopupMenu's own setter (`popup_menu.cpp:62-73`).
 */
enum ItemCheckableType {
  NONE = 0,
  CHECK_BOX = 1,
  RADIO_BUTTON = 2,
}

export const ITEM_CHECKABLE_TYPE_NAMES = enumNamesByValue(ItemCheckableType);
