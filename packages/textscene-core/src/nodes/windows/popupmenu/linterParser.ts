/**
 * PopupMenu strict validators for linting.
 *
 * Declare only PopupMenu's OWN members, the ones doc/classes/PopupMenu.xml
 * lists without an `overrides=` attribute, plus the per-item family Godot
 * serialises through a `PropertyListHelper`, never an `ADD_PROPERTY`
 * (popup_menu.cpp:3317-3328, the `base_property_helper.register_property`
 * calls). It is only visible by reading `_get_property_list`/`_set`/`_get`
 * directly: popup_menu.h:258-260 delegate all three to `property_helper`
 * rather than declaring any of their own.
 *
 * `transparent` and `transparent_bg` carry `overrides="Window"`/`"Viewport"`
 * (default-value overrides, not new properties) and are skipped. Everything
 * from Popup up is registered on the ancestor and delivered by the
 * NODE_BASE_TYPES base-walk, so re-declaring an inherited key shadows it and
 * duplicates the rule. Popup itself declares nothing.
 *
 * ## The per-item family is reached under the `item_#/*` pattern
 *
 * `PropertyListHelper::get_property_list` names each leaf
 * `vformat("%s%d/%s", prefix, i, name)` (property_list_helper.cpp:149), so a
 * real key looks like `item_0/text`: the index is GLUED to the prefix, with no
 * `/` between them. That is a different shape from `bones/<idx>/<sub>`, where a
 * literal `/` follows the fixed segment, so the registry matches it under the
 * `item_#/*` pattern rather than `item_/*` (ValidatorRegistry.findOwnValidator).
 *
 * The dispatcher parses the index itself and rejects a malformed one, mirroring
 * `PropertyListHelper::_get_property` (property_list_helper.cpp:47-55). It sees
 * one key at a time, so the high end of the index range — at or past
 * `item_count` — is linter.ts's rule instead.
 */

import '../window/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../linter/validators/indexedFamily.js';
import { ITEM_CHECKABLE_TYPE } from '../../../linter/validators/sharedEnumLabels.js';

import { v } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

// NativeMenu::SystemMenus, contiguous 0-5 (native_menu.h:59-66), each one bound
// (native_menu.cpp:125-130) and documented (doc/classes/NativeMenu.xml:757-774).
// popup_menu.cpp:3262's PROPERTY_HINT_ENUM "None:0,Application Menu:2,Window
// Menu:3,Help Menu:4,Dock:5" omits MAIN_MENU_ID from the inspector dropdown, but
// PopupMenu.xml:673 types the member as the whole enum, so 1 stays in range.
const SYSTEM_MENU = {
  0: 'INVALID_MENU_ID',
  1: 'MAIN_MENU_ID',
  2: 'APPLICATION_MENU_ID',
  3: 'WINDOW_MENU_ID',
  4: 'HELP_MENU_ID',
  5: 'DOCK_MENU_ID',
};

// popup_menu.h:65-67, Item::CHECKABLE_TYPE_NONE/CHECK_BOX/RADIO_BUTTON, in
// declaration order (0/1/2), matching the ADD_PROPERTY hint at :3323.

/**
 * `item_<idx>/<leaf>` leaves, keyed by leaf name: the 7 properties
 * `base_property_helper.register_property` adds (popup_menu.cpp:3321-3327).
 * Every leaf setter is reached through `PropertyListHelper::_call_setter`,
 * which just forwards `(index, value)` to the bound method
 * (property_list_helper.cpp:66-72), so the grounding is whichever real
 * setter owns each leaf; none of them touch the index itself.
 */
const ITEM_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // popup_menu.cpp:3321, Variant::STRING, no hint. set_item_text
  // (popup_menu.cpp:1951) is a bare assignment past the ERR_FAIL_INDEX on
  // p_idx (an array-index guard, not a value bound).
  text: v.quotedString('text'),
  // popup_menu.cpp:3322, Variant::OBJECT, PROPERTY_HINT_RESOURCE_TYPE
  // "Texture2D". set_item_icon (popup_menu.cpp:2024) is a bare assignment.
  // A null icon is normally omitted rather than written literally, for want of
  // PROPERTY_USAGE_STORE_IF_NULL (unlike GraphNode's slot icons). That is a
  // write-side fact; the literal still loads and the combinator accepts it.
  icon: v.resourceReference('icon'),
  // popup_menu.cpp:3323, Variant::INT, PROPERTY_HINT_ENUM "No,As
  // checkbox,As radio button" (values 0-2). `_set_item_checkable_type`
  // (popup_menu.cpp:62-73) switches on exactly those 3 values with NO
  // default case: a value outside 0-2 matches no case, so the item's
  // checkable_type is left exactly as it was before the write, a silently
  // dropped write (ADR-0032), not a value the setter "assigns straight
  // through" the way a hinted bound requires. Enforced, not hinted.
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

const itemValidator = indexedFamilyValidator({
  prefix: 'item_',
  leaves: ITEM_LEAVES,
  unknownCode: 'INVALID_ITEM_KEY',
  describes: 'item_<index>/<leaf> (see popup_menu.cpp, PropertyListHelper-backed)',
  // `_set` routes straight to `property_helper.property_set_value`
  // (popup_menu.cpp:3092), whose `_get_property` returns nullptr unless the
  // index `is_valid_int()` (property_list_helper.cpp:53-55), so a non-numeric
  // index is a DROPPED write.
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
  // enforced. The enum is contiguous, so a 0-5 range check is exactly its
  // constant set.
  system_menu_id: v.enumInt('system_menu_id', 0, 5, SYSTEM_MENU, {
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
