/**
 * MenuButton strict validators for linting.
 *
 * Declare only MenuButton's OWN members: doc/classes/MenuButton.xml lists
 * `item_count` and `switch_on_hover` without an `overrides=` attribute, plus a
 * `popup/item_<idx>/<leaf>` family MenuButton exposes through its own
 * `PropertyListHelper` (menu_button.h:44-45 declares `base_property_helper`
 * and `property_helper`, distinct from PopupMenu's own pair). It is only
 * visible by reading `_bind_methods`/`_set`/`_get` directly: menu_button.h:53
 * delegates `_get_property_list` to `property_helper.get_property_list`.
 *
 * `action_mode`, `flat`, `focus_mode` and `toggle_mode` carry
 * `overrides="BaseButton"`/`"Button"`/`"Control"`/`"BaseButton"` (default-value
 * overrides, not new properties) and are skipped. Everything from Button up
 * is registered on the ancestor and delivered by the NODE_BASE_TYPES
 * base-walk, so re-declaring an inherited key shadows it and duplicates the
 * rule.
 *
 * ## The `popup/item_` family forwards to PopupMenu's own setters
 *
 * MenuButton registers its 7 leaf names with the 2-argument
 * `register_property(info, default)` overload only (menu_button.cpp:215-221),
 * the one `property_list_helper.h:68-69` documents as "Register property
 * without setter/getter. Only use when you don't need PropertyListHelper for
 * _set/_get logic", so MenuButton's OWN PropertyListHelper never calls a
 * setter. `MenuButton::_set` (menu_button.cpp:174-181) instead forwards the
 * raw write to its internal popup child once `property_helper.is_property_valid`
 * recognises the key: `popup->set(sname.trim_prefix("popup/"), p_value,
 * &valid)`. That reaches `PopupMenu::_set` (popup_menu.cpp:3091), which calls
 * `property_helper.property_set_value` on the POPUP's own helper, and from
 * there PopupMenu's own bound setters (popup_menu.cpp:3321-3327). The
 * grounding for each leaf's write behaviour therefore cites popup_menu.cpp,
 * the file that actually runs, per ADR-0032's "a setter that delegates
 * carries the delegate's guard".
 *
 * The HINT that governs the widget/warning tier for a value on a MenuButton
 * node is MenuButton's OWN `register_property` call (menu_button.cpp:215-221)
 * though, since that is the `PropertyInfo` this node type's
 * `get_property_list` reports for the key, a declaration separate from
 * PopupMenu's own, even where the hint text is identical.
 *
 * ## The key is `popup/item_<idx>/<leaf>`, not `item_<idx>/<leaf>`
 *
 * `base_property_helper.set_prefix("popup/item_")` (menu_button.cpp:213)
 * glues the index onto `popup/item_`, per
 * `PropertyListHelper::get_property_list`'s `vformat("%s%d/%s", prefix, i,
 * name)` (property_list_helper.cpp:149), a real scene writes
 * `popup/item_0/text`, never `item_0/text` (confirmed against
 * scenes/demos/gui/control_gallery/control_gallery.tscn:527, a real Godot
 * MenuButton). Registered under `popup/item_#/*` so `ValidatorRegistry`'s
 * glued-index matcher applies (`ValidatorRegistry.findOwnValidator`, which
 * names MenuButton alongside PopupMenu/ItemList/OptionButton/TabBar as a
 * `#/*` user).
 */

import '../button/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';import { ITEM_CHECKABLE_TYPE } from '../../../../linter/validators/sharedEnumLabels.js';

import { v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

// menu_button.cpp:217, PROPERTY_HINT_ENUM "No,As Checkbox,As Radio Button",
// values 0-2 in popup_menu.h:65-67's declaration order (the same
// ITEM_CHECKABLE_TYPE enum PopupMenu's own item family uses).

/**
 * `popup/item_<idx>/<leaf>` leaves, keyed by leaf name: the 7 properties
 * `base_property_helper.register_property` adds (menu_button.cpp:215-221).
 * Every write forwards through `popup->set(...)` to PopupMenu's own bound
 * setter (see file header), so the grounding is whichever real setter in
 * popup_menu.cpp owns the leaf; none of them touch the index itself.
 */
const ITEM_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // menu_button.cpp:215, Variant::STRING, no hint. Forwards to
  // PopupMenu::set_item_text (popup_menu.cpp:1951), a bare assignment past
  // the ERR_FAIL_INDEX on p_idx (an array-index guard, not a value bound).
  text: v.quotedString('text'),
  // menu_button.cpp:216, Variant::OBJECT, PROPERTY_HINT_RESOURCE_TYPE
  // "Texture2D". Forwards to PopupMenu::set_item_icon (popup_menu.cpp:2024),
  // a bare assignment.
  icon: v.resourceReference('icon'),
  // menu_button.cpp:217, Variant::INT, PROPERTY_HINT_ENUM "No,As
  // Checkbox,As Radio Button" (values 0-2). Forwards to
  // PopupMenu::_set_item_checkable_type (popup_menu.cpp:62-73), a switch
  // over exactly those 3 values with NO default case: an out-of-range value
  // matches no case, so the item's checkable_type is left exactly as it was
  // before the write, a silently dropped write (ADR-0032), not a value the
  // setter "assigns straight through" the way a hinted bound requires.
  // Enforced, not hinted.
  checkable: v.enumInt('checkable', 0, 2, ITEM_CHECKABLE_TYPE, { enforced: 'popup_menu.cpp:62' }),
  // menu_button.cpp:218, Variant::BOOL, no hint.
  checked: v.boolean('checked'),
  // menu_button.cpp:219, Variant::INT, PROPERTY_HINT_RANGE
  // "0,10,1,or_greater": `or_greater` opens the max end, so only the 0
  // floor is a bound, grounded in MenuButton's OWN registration since that
  // is the PropertyInfo this node type's key carries. Forwards to
  // PopupMenu::set_item_id (popup_menu.cpp:2099), a bare assignment on the
  // value (no ERR_FAIL), so the floor is a warning, not an error.
  id: v.int('id', { min: 0, hinted: 'menu_button.cpp:219' }),
  // menu_button.cpp:220, Variant::BOOL, no hint.
  disabled: v.boolean('disabled'),
  // menu_button.cpp:221, Variant::BOOL, no hint.
  separator: v.boolean('separator'),
};

const itemValidator = indexedFamilyValidator({
  prefix: 'popup/item_',
  leaves: ITEM_LEAVES,
  unknownCode: 'INVALID_ITEM_KEY',
  describes: 'item',
  // `_set` gates on `property_helper.is_property_valid` (menu_button.cpp:176),
  // which returns false unless the index `is_valid_int()`
  // (property_list_helper.cpp:126), so a non-numeric index is a DROPPED write.
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
  // menu_button.cpp:205, ADD_ARRAY_COUNT (PROPERTY_HINT_NONE, no hint
  // string, same macro shape as PopupMenu's own item_count). set_item_count
  // (menu_button.cpp:123-131) is `ERR_FAIL_COND(p_count < 0)`: the floor is
  // enforced directly on MenuButton, before any forwarding to the popup
  // child; there is no ceiling anywhere.
  item_count: v.int('item_count', { min: 0, enforced: 'menu_button.cpp:124' }),

  'popup/item_#/*': itemValidator,
});
