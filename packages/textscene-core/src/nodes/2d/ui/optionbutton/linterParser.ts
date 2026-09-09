/**
 * OptionButton strict validators for linting.
 *
 * `text` and `icon` (doc/classes/OptionButton.xml:10: "[b]Note:[/b] The
 * [member Button.text] and [member Button.icon] properties are set
 * automatically based on the selected item. They shouldn't be changed
 * manually.") are NOT modelled as a removal. `OptionButton::_validate_property`
 * (option_button.cpp:554-558) clears their usage to PROPERTY_USAGE_NONE, but
 * Button's own setters (`set_text`/`set_button_icon`, called directly by
 * `OptionButton::_select` at option_button.cpp:423-424 to reflect the current
 * item) are untouched: a hand-authored value is inert once a selection
 * overwrites it, not refused. The same shape as `SpinBox.exp_edit` and
 * `FileDialog.dialog_text`: left to inherit Button's validator unchanged.
 *
 * `action_mode` and `alignment` carry `overrides="BaseButton"`/`overrides=
 * "Button"` (default-value overrides only, doc/classes/OptionButton.xml:231-232)
 * and are skipped: Button/BaseButton already own them. `toggle_mode` is the
 * same shape: OptionButton's constructor flips its DEFAULT to true
 * (option_button.cpp:652), already accounted for by basebutton/linter.ts's
 * `TOGGLE_MODE_ON_BY_DEFAULT` set, so it is not a new property.
 *
 * OptionButton's genuine own members (doc/classes/OptionButton.xml <members>
 * with no `overrides=`): `selected`, `fit_to_longest_item`, `allow_reselect`,
 * `item_count`, plus the `popup/item_<idx>/<leaf>` family declared by
 * `ADD_ARRAY_COUNT("Items", "item_count", "set_item_count", "get_item_count",
 * "popup/item_")` (option_button.cpp:604).
 *
 * The item family is OptionButton's OWN `PropertyListHelper`
 * (`base_property_helper`, option_button.h:67), not a forward to PopupMenu's:
 * it registers only 5 leaves (option_button.cpp:628-632) against PopupMenu's 7
 * (popup_menu.cpp:3321-3327), no `checkable`/`checked`, because OptionButton
 * forces every item radio-checkable itself (`set_item_as_radio_checkable`,
 * option_button.cpp:325) instead of exposing the choice as a per-item
 * property. `OptionButton::_set` (option_button.cpp:162-184) validates the key
 * shape against its own `property_helper` and then forwards the key with the
 * `popup/` prefix stripped straight to `popup->set(...)`, which reaches
 * PopupMenu's real per-leaf setters, so the grounding for `id` below cites
 * OptionButton's OWN hint declaration (its `register_property` call for THIS
 * node type), not PopupMenu's, because the hint text is redeclared
 * independently per class even though the underlying setter is shared.
 */

import '../button/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

/**
 * `popup/item_<idx>/<leaf>` leaves, the 5 properties
 * `base_property_helper.register_property` adds (option_button.cpp:628-632).
 * Every leaf's real setter is reached by `OptionButton::_set` forwarding
 * (`popup->set(...)`, option_button.cpp:168) to PopupMenu's own leaf setter of
 * the same name; the citations below are for the identical underlying methods
 * popupmenu/linterParser.ts already verified.
 */
const ITEM_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // option_button.cpp:628, Variant::STRING, no hint. Forwards to
  // PopupMenu::set_item_text (popup_menu.cpp:1951), a bare assignment past an
  // ERR_FAIL_INDEX on the item INDEX (not the text value).
  text: v.quotedString('text'),
  // option_button.cpp:629, Variant::OBJECT, PROPERTY_HINT_RESOURCE_TYPE
  // "Texture2D". Forwards to PopupMenu::set_item_icon (popup_menu.cpp:2024),
  // a bare assignment.
  icon: v.resourceReference('icon'),
  // option_button.cpp:630, Variant::INT, PROPERTY_HINT_RANGE
  // "0,10,1,or_greater": `or_greater` opens the max end, so only the 0 floor
  // is a real bound. Forwards to PopupMenu::set_item_id (popup_menu.cpp:2099),
  // which ERR_FAIL_INDEXes the item INDEX but assigns the id VALUE straight
  // through, so the floor is a warning (hinted), grounded at OptionButton's
  // own hint declaration rather than PopupMenu's (see file header).
  id: v.int('id', { min: 0, hinted: 'option_button.cpp:630' }),
  // option_button.cpp:631, Variant::BOOL, no hint.
  disabled: v.boolean('disabled'),
  // option_button.cpp:632, Variant::BOOL, no hint.
  separator: v.boolean('separator'),
};

const itemValidator = indexedFamilyValidator({
  prefix: 'popup/item_',
  leaves: ITEM_LEAVES,
  unknownCode: 'INVALID_ITEM_KEY',
  describes: 'item',
  // `_set` gates on `property_helper.is_property_valid` (option_button.cpp:166),
  // which returns false unless the index `is_valid_int()`
  // (property_list_helper.cpp:126), so a non-numeric index is a DROPPED write.
  indexParse: 'is_valid_int',
  negativeIndex: {
    cite: 'property_list_helper.cpp:58',
    code: 'INVALID_ITEM_INDEX',
    message: (index) =>
      `Item index ${index} must be non-negative. OptionButton's item family refuses a negative index the same way PopupMenu's does (property_list_helper.cpp:58), so this property is never applied`,
  },
});

validatorRegistry.registerAll('OptionButton', {
  // option_button.cpp:601, Variant::INT, no hint (PROPERTY_HINT_NONE).
  // `_select_int` (option_button.cpp:432-443) returns without assigning when
  // `p_which < NONE_SELECTED` (-1, option_button.cpp:433), a silently dropped
  // write, so the floor is enforced. The high end (>= item_count) is a bound
  // against a runtime sibling count invisible to a per-property validator
  // (ADR-0032); see linter.ts for the cross-field rule that covers it instead.
  selected: v.int('selected', { min: -1, enforced: 'option_button.cpp:433' }),
  // option_button.cpp:602, Variant::BOOL, no hint.
  // set_fit_to_longest_item (option_button.cpp:369-376) is a bare assignment
  // guarded only by an equality early-out.
  fit_to_longest_item: v.boolean('fit_to_longest_item'),
  // option_button.cpp:603, Variant::BOOL, no hint.
  // set_allow_reselect (option_button.cpp:382-384) is a bare assignment.
  allow_reselect: v.boolean('allow_reselect'),
  // option_button.cpp:604, ADD_ARRAY_COUNT, PROPERTY_HINT_NONE.
  // set_item_count (option_button.cpp:309-310) is `ERR_FAIL_COND(p_count < 0)`:
  // the floor is enforced; there is no ceiling anywhere.
  item_count: v.int('item_count', { min: 0, enforced: 'option_button.cpp:310' }),

  'popup/item_#/*': itemValidator,
});
