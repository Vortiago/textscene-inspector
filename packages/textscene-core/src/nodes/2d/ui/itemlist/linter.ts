/**
 * Semantic rule for ItemList: an `item_<N>/…` index at or past `item_count`.
 * linterParser.ts checks each leaf alone; this rule reads the sibling count.
 * Godot's saver never writes it: `item_count` (`ADD_ARRAY_COUNT`, item_list.cpp:2403)
 * precedes the leaves, and `items.resize(p_count)` (item_list.cpp:542) keeps them in step.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { armEmits, type RuleArms } from '../../../../linter/ruleArms.js';
import { pastCountDiagnostic } from '../../../../linter/reportedIndices.js';
import { ITEM_LIST_ITEMS } from '../../../../godot/classdb/propertyListFamilies.js';
import { descendsFromClass } from '../../../../godot/classdb/classBaseTypes.js';

const arms = {
  itemIndexOutOfRange: {
    severity: 'error',
    ruleName: 'itemlist-item-index-out-of-range',
    grounding: { kind: 'engine', at: ITEM_LIST_ITEMS.outOfBounds.at },
  },
} as const satisfies RuleArms<string>;

// The leaves go through a `PropertyListHelper` (item_list.cpp:2461-2466), whose
// `_get_property` (property_list_helper.cpp:46-64) returns null when
// `index < 0 || (!p_allow_oob && index >= _call_array_length_getter())`. Only
// TabContainer enables `p_allow_oob` (tab_container.cpp:1294).
function checkItemList({ node }: RuleContext): Diagnostic[] {
  // An absent item_count is the default 0 (doc/classes/ItemList.xml): an empty `Vector<Item> items`,
  // so every item key is out of range. The family dispatcher in linterParser.ts reports a negative
  // index, so only the high end is this rule's.
  // `ItemList::_set` (item_list.cpp:2237-2240) calls `property_set_value`, which returns
  // false for that index (property_list_helper.cpp:166-175), so no `set_item_*` setter
  // runs and nothing is logged: the silently dropped write ADR-0032 grounds on.
  return pastCountDiagnostic(
    node,
    ITEM_LIST_ITEMS,
    arms.itemIndexOutOfRange,
    (indices, count) => `ItemList item index(es) ${indices} fall outside item_count (${count}).`
  );
}

const itemListValidationRule: LintRule = {
  meta: {
    name: 'valid-itemlist-properties',
    description: "Validates ItemList's dynamic item_<N>/… indices stay within item_count",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFromClass(nodeType, ITEM_LIST_ITEMS.owner),
    emits: armEmits(arms),
  },
  check: checkItemList,
};

ruleRegistry.register(itemListValidationRule);
