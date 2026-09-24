/**
 * OptionButton's strict validators: `selected`, `fit_to_longest_item`, `allow_reselect`, `item_count` and the
 * `popup/item_<idx>/<leaf>` family of `ADD_ARRAY_COUNT` (option_button.cpp:604), which doc/classes/OptionButton.xml
 * lists without `overrides=`. `action_mode` and `alignment` override defaults only (doc/classes/OptionButton.xml:231-232),
 * and `toggle_mode`'s default flip (option_button.cpp:652) is basebutton/linter.ts's `TOGGLE_MODE_ON_BY_DEFAULT`.
 */

// `text` and `icon` inherit Button's validators. `_validate_property` hides them (option_button.cpp:554-558,
// doc/classes/OptionButton.xml:10), but `_select` sets them through Button's setters (option_button.cpp:423-424),
// so an authored value is overwritten, not refused, as with `SpinBox.exp_edit` and `FileDialog.dialog_text`.
import '../button/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { indexedFamilyValidator } from '../../../../linter/validators/indexedFamily.js';
import { v } from '../../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../../linter/ValidatorRegistry.js';

/**
 * The 5 leaves OptionButton's own `base_property_helper` (option_button.h:67) registers
 * (option_button.cpp:628-632), without PopupMenu's `checkable`/`checked` (popup_menu.cpp:3321-3327), since every
 * item is radio-checkable (option_button.cpp:325). `_set` (option_button.cpp:162-184) forwards to `popup->set(...)`
 * (option_button.cpp:168), so setters cite PopupMenu's, as popupmenu/linterParser.ts does, and hints cite OptionButton's.
 */
const ITEM_LEAVES: Readonly<Record<string, PropertyValidator>> = {
  // option_button.cpp:628, no hint. PopupMenu::set_item_text (popup_menu.cpp:1951) assigns past an
  // ERR_FAIL_INDEX on the item index, not the text.
  text: v.quotedString('text'),
  // option_button.cpp:629, PROPERTY_HINT_RESOURCE_TYPE "Texture2D". PopupMenu::set_item_icon
  // (popup_menu.cpp:2024) assigns.
  icon: v.resourceReference('icon'),
  // option_button.cpp:630, PROPERTY_HINT_RANGE "0,10,1,or_greater", so only the 0 floor bounds.
  // PopupMenu::set_item_id (popup_menu.cpp:2099) checks the item index and assigns the id, so the floor
  // warns, cited at OptionButton's own hint.
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
  // `_set` gates on `property_helper.is_property_valid` (option_button.cpp:166), which needs an
  // `is_valid_int()` index (property_list_helper.cpp:126), so a non-numeric index is a dropped write.
  indexParse: 'is_valid_int',
  negativeIndex: {
    cite: 'property_list_helper.cpp:58',
    code: 'INVALID_ITEM_INDEX',
    message: (index) =>
      `Item index ${index} must be non-negative. OptionButton's item family refuses a negative index the same way PopupMenu's does (property_list_helper.cpp:58), so this property is never applied`,
  },
});

validatorRegistry.registerAll('OptionButton', {
  // option_button.cpp:601, PROPERTY_HINT_NONE. `_select_int` (option_button.cpp:432-443) drops a write
  // below NONE_SELECTED (-1, option_button.cpp:433), so the floor is enforced. The high end, against the
  // sibling count, is the cross-field rule in linter.ts (ADR-0032).
  selected: v.int('selected', { min: -1, enforced: 'option_button.cpp:433' }),
  // option_button.cpp:602, Variant::BOOL, no hint.
  // set_fit_to_longest_item (option_button.cpp:369-376) assigns past an equality early-out.
  fit_to_longest_item: v.boolean('fit_to_longest_item'),
  // option_button.cpp:603, Variant::BOOL, no hint.
  // set_allow_reselect (option_button.cpp:382-384) is a bare assignment.
  allow_reselect: v.boolean('allow_reselect'),
  // option_button.cpp:604, ADD_ARRAY_COUNT, PROPERTY_HINT_NONE. set_item_count (option_button.cpp:309-310)
  // enforces `ERR_FAIL_COND(p_count < 0)`, and nothing sets a ceiling.
  item_count: v.int('item_count', { min: 0, enforced: 'option_button.cpp:310' }),

  'popup/item_#/*': itemValidator,
});
