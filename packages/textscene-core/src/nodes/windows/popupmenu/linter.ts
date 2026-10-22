/**
 * PopupMenu's cross-field rule: an `item_<N>/…` index at or past `item_count`. The
 * leaves come from a `PropertyListHelper` (popup_menu.cpp:3319-3328), whose
 * `_get_property` (property_list_helper.cpp:46-64) resolves no index `>= item_count`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes.js';
import { pastCountDiagnostic } from '../../../linter/reportedIndices.js';
import { POPUP_MENU_ITEMS } from '../../../godot/classdb/propertyListFamilies.js';
import { armEmits, type RuleArms } from '../../../linter/ruleArms.js';

const arms = {
  itemIndexOutOfRange: {
    severity: 'error',
    ruleName: 'popupmenu-item-index-out-of-range',
    grounding: { kind: 'engine', at: POPUP_MENU_ITEMS.outOfBounds.at },
  },
} as const satisfies RuleArms<string>;

// Godot's saver never writes this: `item_count` (`ADD_ARRAY_COUNT`, popup_menu.cpp:3267)
// precedes the item leaves, and `items.resize(p_count)` (popup_menu.cpp:2718) keeps
// them in step. Only a hand-edited scene fires it.
function checkPopupMenu({ node }: RuleContext): Diagnostic[] {
  const diagnostic = pastCountDiagnostic(
    node,
    // Absent means the default 0 (doc/classes/PopupMenu.xml), which the serialiser omits: an empty
    // `Vector<Item> items`, so every item key is out of range. Resolved the way `_get_property` does,
    // so a key with no leaf, such as `item_3/`, names no item. linterParser.ts reports a negative
    // index, so this checks only the high end, and one mistake gets one diagnostic.
    POPUP_MENU_ITEMS,
    arms.itemIndexOutOfRange,
    // `p_allow_oob` is false: `enable_out_of_bounds_assign()` (property_list_helper.h:92)
    // has one caller, tab_container.cpp:1294. `PopupMenu::_set` (popup_menu.cpp:3091-3094)
    // goes through `property_set_value` (property_list_helper.cpp:166-175), which drops
    // the write with no log: the dropped write ADR-0032 grounds a diagnostic on.
    (indices, count) =>
      `PopupMenu item index(es) ${indices} fall outside item_count (${count}). ` +
      'PropertyListHelper::_get_property (property_list_helper.cpp:58) returns null for ' +
      'an index >= the array length, so PopupMenu never calls the matching setter and ' +
      'these item_<N>/… values are silently dropped on load.'
  );
  return diagnostic ? [diagnostic] : [];
}

const popupMenuValidationRule: LintRule = {
  meta: {
    name: 'valid-popupmenu-properties',
    description: "Validates PopupMenu's dynamic item_<N>/… indices stay within item_count",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFromClass(nodeType, POPUP_MENU_ITEMS.owner),
    emits: armEmits(arms),
  },
  check: checkPopupMenu,
};

ruleRegistry.register(popupMenuValidationRule);
