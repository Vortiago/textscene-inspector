/**
 * MenuButton's strict validators: `item_count`, `switch_on_hover` and the `popup/item_<idx>/<leaf>` family
 * of its own PropertyListHelper (menu_button.h:44-45, listed through menu_button.h:53). doc/classes/MenuButton.xml
 * marks `action_mode`, `flat`, `focus_mode` and `toggle_mode` `overrides=`, default changes only, so the
 * NODE_BASE_TYPES base-walk delivers them with Button's, and a re-declared key duplicates the rule.
 */

import '../button/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';import { ITEM_CHECKABLE_TYPE } from '../../../../linter/validators/sharedEnumLabels.js';

import { v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

/**
 * The 7 `popup/item_<idx>/<leaf>` leaves (menu_button.cpp:215-221), registered without setters
 * (property_list_helper.h:68-69). `MenuButton::_set` (menu_button.cpp:174-181) forwards each write to
 * `PopupMenu::_set` (popup_menu.cpp:3091) and its bound setters (popup_menu.cpp:3321-3327), so a leaf cites
 * the guard of the delegate in popup_menu.cpp (ADR-0032). The hint is MenuButton's own `register_property`, even where equal.
 */
const ITEM_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // menu_button.cpp:215, no hint. PopupMenu::set_item_text (popup_menu.cpp:1951) assigns past an
  // ERR_FAIL_INDEX on p_idx, an index guard, not a value bound.
  text: v.quotedString('text'),
  // menu_button.cpp:216, PROPERTY_HINT_RESOURCE_TYPE "Texture2D". PopupMenu::set_item_icon
  // (popup_menu.cpp:2024) assigns.
  icon: v.resourceReference('icon'),
  // menu_button.cpp:217, PROPERTY_HINT_ENUM "No,As Checkbox,As Radio Button": ITEM_CHECKABLE_TYPE 0-2
  // (popup_menu.h:65-67). PopupMenu::_set_item_checkable_type (popup_menu.cpp:62-73) switches over those
  // three with no default case, so an out-of-range write is silently dropped: enforced, not hinted.
  checkable: v.enumInt('checkable', 0, 2, ITEM_CHECKABLE_TYPE, { enforced: 'popup_menu.cpp:63' }),
  // menu_button.cpp:218, Variant::BOOL, no hint.
  checked: v.boolean('checked'),
  // menu_button.cpp:219, PROPERTY_HINT_RANGE "0,10,1,or_greater" on MenuButton's own registration, so
  // only the 0 floor is a bound. PopupMenu::set_item_id (popup_menu.cpp:2099) assigns with no ERR_FAIL,
  // so the floor warns.
  id: v.int('id', { min: 0, hinted: 'menu_button.cpp:219' }),
  // menu_button.cpp:220, Variant::BOOL, no hint.
  disabled: v.boolean('disabled'),
  // menu_button.cpp:221, Variant::BOOL, no hint.
  separator: v.boolean('separator'),
};

// `set_prefix("popup/item_")` (menu_button.cpp:213) glues the index on (property_list_helper.cpp:149), so a
// scene writes `popup/item_0/text` (scenes/demos/gui/control_gallery/control_gallery.tscn:527). The key
// `popup/item_#/*` selects the glued-index matcher of `ValidatorRegistry.findOwnValidator`.
const itemValidator = indexedFamilyValidator({
  prefix: 'popup/item_',
  leaves: ITEM_LEAVES,
  unknownCode: 'INVALID_ITEM_KEY',
  describes: 'item',
  // `_set` gates on `property_helper.is_property_valid` (menu_button.cpp:176), which needs an
  // `is_valid_int()` index (property_list_helper.cpp:126), so a non-numeric index is a dropped write.
  indexParse: 'is_valid_int',
  negativeIndex: {
    cite: 'property_list_helper.cpp:58',
    code: 'INVALID_ITEM_INDEX',
    message: (index) =>
      `Item index ${index} must be non-negative. MenuButton forwards this write to its popup child, whose property helper refuses a negative index (property_list_helper.cpp:58), so it is never applied`,
  },
});

validatorRegistry.registerAll('MenuButton', {
  // menu_button.cpp:204, Variant::BOOL, no hint. set_switch_on_hover
  // (menu_button.cpp:115-117) is a bare assignment.
  switch_on_hover: v.boolean('switch_on_hover'),
  // menu_button.cpp:205, ADD_ARRAY_COUNT with PROPERTY_HINT_NONE, as PopupMenu's item_count.
  // set_item_count (menu_button.cpp:123-131) enforces `ERR_FAIL_COND(p_count < 0)` before forwarding,
  // and nothing sets a ceiling.
  item_count: v.int('item_count', { min: 0, enforced: 'menu_button.cpp:124' }),

  'popup/item_#/*': itemValidator,
});
