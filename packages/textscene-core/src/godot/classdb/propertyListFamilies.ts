/**
 * Every `PropertyListHelper` family the previewer reads, declared once. The family validator, the
 * past-count rule and the parser grouping read these, so a prefix, a count key or an out-of-bounds
 * policy has one line to change.
 */

import { defineIndexedFamily } from './indexedFamily.js';

const DROPPED_PAST_LENGTH = {
  policy: 'dropped',
  at: 'property_list_helper.cpp:58',
} as const;

export const ITEM_LIST_ITEMS = defineIndexedFamily({
  owner: 'ItemList',
  prefix: 'item_',
  indexParse: 'is_valid_int',
  countKey: { key: 'item_count' },
  outOfBounds: DROPPED_PAST_LENGTH,
});

export const TAB_BAR_TABS = defineIndexedFamily({
  owner: 'TabBar',
  prefix: 'tab_',
  indexParse: 'is_valid_int',
  countKey: { key: 'tab_count' },
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
  outOfBounds: { policy: 'assigned', at: 'tab_container.cpp:1294' },
});

export const MENU_BUTTON_ITEMS = defineIndexedFamily({
  owner: 'MenuButton',
  prefix: 'popup/item_',
  indexParse: 'is_valid_int',
  countKey: { key: 'item_count' },
  outOfBounds: DROPPED_PAST_LENGTH,
});

export const POPUP_MENU_ITEMS = defineIndexedFamily({
  owner: 'PopupMenu',
  prefix: 'item_',
  indexParse: 'is_valid_int',
  countKey: { key: 'item_count' },
  outOfBounds: DROPPED_PAST_LENGTH,
});

export const FILE_DIALOG_OPTIONS = defineIndexedFamily({
  owner: 'FileDialog',
  prefix: 'option_',
  indexParse: 'is_valid_int',
  countKey: { key: 'option_count' },
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
  countKey: { key: 'item_count' },
  outOfBounds: DROPPED_PAST_LENGTH,
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
