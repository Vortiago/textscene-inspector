/**
 * PopupMenu strict validators: its own members (doc/classes/PopupMenu.xml without
 * `overrides=`, so not `transparent` or `transparent_bg`) and the per-item family.
 * Members from Popup up arrive through the NODE_BASE_TYPES base walk, and
 * re-declaring one shadows it and duplicates the rule. Popup declares nothing.
 */

import '../window/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../linter/validators/indexedFamily.js';
import { ITEM_CHECKABLE_TYPE } from '../../../linter/validators/sharedEnumLabels.js';

import { v } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

// NativeMenu::SystemMenus, contiguous 0-5 (native_menu.h:59-66), bound
// (native_menu.cpp:125-130) and documented (doc/classes/NativeMenu.xml:757-774).
// PopupMenu.xml:673 types the member as the whole enum, so 1 is in range, although
// popup_menu.cpp:3262's hint omits MAIN_MENU_ID from the dropdown.
const SYSTEM_MENU = {
  0: 'INVALID_MENU_ID',
  1: 'MAIN_MENU_ID',
  2: 'APPLICATION_MENU_ID',
  3: 'WINDOW_MENU_ID',
  4: 'HELP_MENU_ID',
  5: 'DOCK_MENU_ID',
};

/**
 * The ids `popup_menu.cpp:3262` offers: every SYSTEM_MENU id but MAIN_MENU_ID, which
 * the hint's `:value` suffixes skip. Derived so the constant names have one home.
 */
const OFFERED_SYSTEM_MENUS = {
  0: SYSTEM_MENU[0],
  2: SYSTEM_MENU[2],
  3: SYSTEM_MENU[3],
  4: SYSTEM_MENU[4],
  5: SYSTEM_MENU[5],
};

/**
 * The 7 `item_<idx>/<leaf>` leaves (popup_menu.cpp:3321-3327). `_call_setter` forwards
 * `(index, value)` to each leaf's setter (property_list_helper.cpp:66-72), so each
 * leaf is grounded in its own setter.
 */
const ITEM_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // popup_menu.cpp:3321, Variant::STRING, no hint. set_item_text
  // (popup_menu.cpp:1951) is a bare assignment past the ERR_FAIL_INDEX on
  // p_idx (an array-index guard, not a value bound).
  text: v.quotedString('text'),
  // popup_menu.cpp:3322, Variant::OBJECT, "Texture2D". set_item_icon
  // (popup_menu.cpp:2024) is a bare assignment. With no STORE_IF_NULL the saver omits
  // a null icon, but a literal null still loads.
  icon: v.resourceReference('icon'),
  // popup_menu.cpp:3323, INT, PROPERTY_HINT_ENUM 0-2 (popup_menu.h:65-67).
  // `_set_item_checkable_type` (popup_menu.cpp:62-73) has no default case, so a value
  // outside 0-2 leaves the item unchanged: a dropped write (ADR-0032), so enforced.
  checkable: v.enumInt('checkable', 0, 2, ITEM_CHECKABLE_TYPE, { enforced: 'popup_menu.cpp:62' }),
  // popup_menu.cpp:3324, Variant::BOOL, no hint.
  checked: v.boolean('checked'),
  // popup_menu.cpp:3325, Variant::INT, PROPERTY_HINT_RANGE "0,10,1,or_greater":
  // `or_greater` opens the max end, so only the 0 floor is a real bound.
  // set_item_id (popup_menu.cpp:2099) is a bare assignment (no ERR_FAIL), so
  // the floor is a warning, not an error.
  id: v.int('id', { min: 0, hinted: 'popup_menu.cpp:3325' }),
  // popup_menu.cpp:3326, Variant::BOOL, no hint.
  disabled: v.boolean('disabled'),
  // popup_menu.cpp:3327, Variant::BOOL, no hint.
  separator: v.boolean('separator'),
};

/**
 * The per-item family: `base_property_helper.register_property` (popup_menu.cpp:3317-3328)
 * with no `ADD_PROPERTY`, since popup_menu.h:258-260 delegate `_get_property_list`,
 * `_set` and `_get` to `property_helper`. `item_0/text` glues the index to the prefix
 * (property_list_helper.cpp:149), hence `item_#/*` (ValidatorRegistry.findOwnValidator).
 */
const itemValidator = indexedFamilyValidator({
  prefix: 'item_',
  leaves: ITEM_LEAVES,
  unknownCode: 'INVALID_ITEM_KEY',
  describes: 'item_<index>/<leaf> (see popup_menu.cpp, PropertyListHelper-backed)',
  // `_set` routes to `property_helper.property_set_value` (popup_menu.cpp:3092), whose
  // `_get_property` (property_list_helper.cpp:47-55) returns nullptr unless the index
  // `is_valid_int()` (property_list_helper.cpp:53-55): a dropped write. The
  // `>= item_count` end needs a sibling, so linter.ts checks it.
  indexParse: 'is_valid_int',
  negativeIndex: {
    cite: 'property_list_helper.cpp:58',
    code: 'INVALID_ITEM_INDEX',
    message: (index) =>
      `Item index ${index} must be non-negative. PopupMenu's property helper refuses a negative index (property_list_helper.cpp:58), so this property is never applied`,
  },
});

validatorRegistry.registerAll('PopupMenu', {
  // popup_menu.cpp:3257, Variant::BOOL, no hint. set_hide_on_item_selection
  // (popup_menu.cpp:3016-3018) is a bare assignment.
  hide_on_item_selection: v.boolean('hide_on_item_selection'),
  // popup_menu.cpp:3258, Variant::BOOL, no hint.
  // set_hide_on_checkable_item_selection (popup_menu.cpp:3024-3026) is a
  // bare assignment.
  hide_on_checkable_item_selection: v.boolean('hide_on_checkable_item_selection'),
  // popup_menu.cpp:3259, Variant::BOOL, no hint. The bound setter is
  // set_hide_on_multistate_item_selection (popup_menu.cpp:3032-3034), a
  // bare assignment.
  hide_on_state_item_selection: v.boolean('hide_on_state_item_selection'),
  // popup_menu.cpp:3260, Variant::FLOAT, PROPERTY_HINT_NONE ("suffix:s"
  // only, no range). set_submenu_popup_delay (popup_menu.cpp:3040-3045)
  // clamps any value <= 0 up to 0.01, a genuine alteration, so the floor is
  // enforced despite the absent hint.
  submenu_popup_delay: v.positiveFloat('submenu_popup_delay', undefined, {
    enforced: 'popup_menu.cpp:3041',
  }),
  // popup_menu.cpp:3261, Variant::BOOL, no hint. set_allow_search
  // (popup_menu.cpp:3052-3054) is a bare assignment.
  allow_search: v.boolean('allow_search'),
  // popup_menu.cpp:3262, hinted (see SYSTEM_MENU above). set_system_menu
  // (popup_menu.cpp:185-193) assigns unconditionally, so this is hinted, not
  // enforced. The hint's `:value` suffixes leave a gap at MAIN_MENU_ID, which a
  // range cannot state even though the engine enum behind it is contiguous.
  system_menu_id: v.enumSet('system_menu_id', OFFERED_SYSTEM_MENUS, {
    hinted: 'popup_menu.cpp:3262',
  }),
  // popup_menu.cpp:3263, Variant::BOOL, no hint. set_prefer_native_menu
  // (popup_menu.cpp:2755-2763) is a bare assignment guarded only by an
  // equality early-out.
  prefer_native_menu: v.boolean('prefer_native_menu'),
  // popup_menu.cpp:3264, Variant::BOOL, no hint. set_shrink_height
  // (popup_menu.cpp:3385-3387) is a bare assignment.
  shrink_height: v.boolean('shrink_height'),
  // popup_menu.cpp:3265, Variant::BOOL, no hint. set_shrink_width
  // (popup_menu.cpp:3393-3395) is a bare assignment.
  shrink_width: v.boolean('shrink_width'),
  // popup_menu.cpp:3267, ADD_ARRAY_COUNT, which binds PROPERTY_HINT_NONE
  // (class_db.cpp:1492, no hint string at all). set_item_count
  // (popup_menu.cpp:2697-2698) is `ERR_FAIL_COND(p_count < 0)`: the floor is
  // enforced; there is no ceiling anywhere.
  item_count: v.int('item_count', { min: 0, enforced: 'popup_menu.cpp:2698' }),

  'item_#/*': itemValidator,
});
