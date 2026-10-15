/** PopupMenu's item facts, which MenuButton reaches too. */

/**
 * `PopupMenu`'s per-item checkable type, reached by `MenuButton` too, which
 * forwards its item writes to PopupMenu's own setter (`popup_menu.cpp:62-73`).
 */
export const ITEM_CHECKABLE_TYPE = {
  0: 'NONE',
  1: 'CHECK_BOX',
  2: 'RADIO_BUTTON',
} as const;
