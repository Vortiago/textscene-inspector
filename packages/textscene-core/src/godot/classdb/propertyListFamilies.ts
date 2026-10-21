/**
 * Every `PropertyListHelper` family the previewer reads, declared once. The family validator, the
 * past-count rule and the parser grouping read these, so a prefix, a count key or an out-of-bounds
 * policy has one line to change.
 */

import { defineIndexedFamily } from './indexedFamily.js';

const DROPPED_PAST_LENGTH = {
  policy: 'dropped',
  cite: 'property_list_helper.cpp:58',
} as const;

export const ITEM_LIST_ITEMS = defineIndexedFamily({
  owner: 'ItemList',
  prefix: 'item_',
  indexParse: 'is_valid_int',
  countKey: { key: 'item_count', cite: 'item_list.cpp:2403' },
  leaves: ['text', 'icon', 'selectable', 'disabled'],
  outOfBounds: DROPPED_PAST_LENGTH,
});

export const TAB_BAR_TABS = defineIndexedFamily({
  owner: 'TabBar',
  prefix: 'tab_',
  indexParse: 'is_valid_int',
  countKey: { key: 'tab_count', cite: 'tab_bar.cpp:2137' },
  leaves: ['title', 'tooltip', 'icon', 'disabled'],
  outOfBounds: DROPPED_PAST_LENGTH,
});

/**
 * No count key: the length is the child count (`get_tab_count`, tab_container.cpp:1270), and the
 * helper assigns past it (`enable_out_of_bounds_assign`, tab_container.cpp:1294) into a pending tab
 * (`set_tab_title`, tab_container.cpp:883-890).
 */
export const TAB_CONTAINER_TABS = defineIndexedFamily({
  owner: 'TabContainer',
  prefix: 'tab_',
  indexParse: 'is_valid_int',
  countKey: { key: null, cite: 'tab_container.cpp:1270-1275' },
  leaves: ['title', 'icon', 'disabled', 'hidden'],
  outOfBounds: { policy: 'assigned', cite: 'tab_container.cpp:1294' },
});

export const MENU_BUTTON_ITEMS = defineIndexedFamily({
  owner: 'MenuButton',
  prefix: 'popup/item_',
  indexParse: 'is_valid_int',
  countKey: { key: 'item_count', cite: 'menu_button.cpp:205' },
  leaves: ['text', 'icon', 'checkable', 'checked', 'id', 'disabled', 'separator'],
  outOfBounds: DROPPED_PAST_LENGTH,
});

export const POPUP_MENU_ITEMS = defineIndexedFamily({
  owner: 'PopupMenu',
  prefix: 'item_',
  indexParse: 'is_valid_int',
  countKey: { key: 'item_count', cite: 'popup_menu.cpp:3267' },
  leaves: ['text', 'icon', 'checkable', 'checked', 'id', 'disabled', 'separator'],
  outOfBounds: DROPPED_PAST_LENGTH,
});

export const FILE_DIALOG_OPTIONS = defineIndexedFamily({
  owner: 'FileDialog',
  prefix: 'option_',
  indexParse: 'is_valid_int',
  countKey: { key: 'option_count', cite: 'file_dialog.cpp:2123' },
  leaves: ['name', 'values', 'default'],
  outOfBounds: DROPPED_PAST_LENGTH,
});

/**
 * `_set` gates on `is_property_valid`, which checks no length (property_list_helper.cpp:118-135),
 * then forwards to the popup (option_button.cpp:168), whose helper drops past its length
 * (property_list_helper.cpp:58).
 */
export const OPTION_BUTTON_ITEMS = defineIndexedFamily({
  owner: 'OptionButton',
  prefix: 'popup/item_',
  indexParse: 'is_valid_int',
  countKey: { key: 'item_count', cite: 'option_button.cpp:604' },
  leaves: ['text', 'icon', 'id', 'disabled', 'separator'],
  outOfBounds: { policy: 'dropped', cite: 'option_button.cpp:168, property_list_helper.cpp:58' },
});

export const PROPERTY_LIST_FAMILIES = [
  ITEM_LIST_ITEMS,
  TAB_BAR_TABS,
  TAB_CONTAINER_TABS,
  MENU_BUTTON_ITEMS,
  POPUP_MENU_ITEMS,
  FILE_DIALOG_OPTIONS,
  OPTION_BUTTON_ITEMS,
] as const;
