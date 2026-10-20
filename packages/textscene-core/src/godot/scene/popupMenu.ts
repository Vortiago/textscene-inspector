/** PopupMenu's item facts, which MenuButton reaches too, and the system menus it offers. */

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

/**
 * `NativeMenu::SystemMenus`, contiguous 0-5 (`servers/display/native_menu.h:59-66`, 4.7.2 `:61-68`),
 * bound at `native_menu.cpp:125-130`. `PopupMenu.xml:673` types `system_menu_id` as the whole enum.
 */
const SystemMenu = {
  INVALID_MENU_ID: 0,
  MAIN_MENU_ID: 1,
  APPLICATION_MENU_ID: 2,
  WINDOW_MENU_ID: 3,
  HELP_MENU_ID: 4,
  DOCK_MENU_ID: 5,
} as const;

const SYSTEM_MENU_NAMES = enumNamesByValue(SystemMenu);

/**
 * The system menus `popup_menu.cpp:3262` offers: every one but `MAIN_MENU_ID`, which the hint's
 * `:value` suffixes skip, so the offered ids leave a gap that a range cannot state.
 */
export const OFFERED_SYSTEM_MENU_NAMES: Readonly<Record<number, string>> = Object.freeze(
  Object.fromEntries(
    Object.entries(SYSTEM_MENU_NAMES).filter(([id]) => Number(id) !== SystemMenu.MAIN_MENU_ID)
  )
);
