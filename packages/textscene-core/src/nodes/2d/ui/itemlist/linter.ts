/**
 * Semantic rule for ItemList: an `item_<N>/…` index at or past `item_count`.
 * linterParser.ts checks each leaf alone; this rule reads the sibling count.
 * Godot's saver never writes it: `item_count` (`ADD_ARRAY_COUNT`, item_list.cpp:2403)
 * precedes the leaves, and `items.resize(p_count)` (item_list.cpp:542) keeps them in step.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { indicesPastCount, listWrittenIndices } from '../../../../linter/reportedIndices.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { ruleCount } from '../../../../linter/validators/commonValidators.js';

/**
 * The family's prefix. ItemList serves it through a `PropertyListHelper` (item_list.cpp), whose
 * `_get_property` gates the index on `String::is_valid_int()` (property_list_helper.cpp:53).
 */
const ITEM_PREFIX = 'item_';

// The leaves go through a `PropertyListHelper` (item_list.cpp:2461-2466), whose
// `_get_property` (property_list_helper.cpp:46-64) returns null when
// `index < 0 || (!p_allow_oob && index >= _call_array_length_getter())`. Only
// TabContainer enables `p_allow_oob` (tab_container.cpp:1294).
function checkItemList(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;
  if (!isValidProperties(node.properties)) return diagnostics;
  const rawProps = node.properties as Record<string, string>;

  const countRaw = rawProps.item_count;
  // Absent means the default 0 (doc/classes/ItemList.xml), which the serialiser
  // omits: an empty `Vector<Item> items`, so every item key is out of range.
  const count = ruleCount(countRaw);
  // A malformed item_count already draws its own validator's diagnostic, and a
  // non-finite one is altered at parse to a number the file does not state, so
  // neither is a count this rule can name in a message.
  if (count === null) return diagnostics;

  // Resolved as `_get_property` resolves it. The family dispatcher in linterParser.ts reports a
  // negative index, so only the high end is this rule's.
  const offending = indicesPastCount(rawProps, ITEM_PREFIX, 'is_valid_int', count);
  if (offending.size === 0) return diagnostics;

  // `ItemList::_set` (item_list.cpp:2237-2240) calls `property_set_value`, which returns
  // false for that index (property_list_helper.cpp:166-175), so no `set_item_*` setter
  // runs and nothing is logged: the silently dropped write ADR-0032 grounds on.
  const indices = listWrittenIndices(offending);
  diagnostics.push({
    severity: 'error',
    message:
      `ItemList item index(es) ${indices} fall outside item_count (${count}). ` +
      'PropertyListHelper::_get_property (property_list_helper.cpp:58) returns null for ' +
      'an index >= the array length, so ItemList never calls the matching setter and ' +
      'these item_<N>/… values are silently dropped on load.',
    nodeName: node.name,
    nodeType: node.type,
    ruleName: 'itemlist-item-index-out-of-range',
  });

  return diagnostics;
}

const itemListValidationRule: LintRule = {
  meta: {
    name: 'valid-itemlist-properties',
    description: "Validates ItemList's dynamic item_<N>/… indices stay within item_count",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'ItemList'),
    emits: [
      {
        ruleName: 'itemlist-item-index-out-of-range',
        severity: 'error',
        grounding: { kind: 'engine', at: 'property_list_helper.cpp:58' },
      },
    ],
  },
  check: checkItemList,
};

ruleRegistry.register(itemListValidationRule);

export { itemListValidationRule };
