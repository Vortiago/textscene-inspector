/**
 * PopupMenu's cross-field rule: an `item_<N>/…` index at or past `item_count`. The
 * leaves come from a `PropertyListHelper` (popup_menu.cpp:3319-3328), whose
 * `_get_property` (property_list_helper.cpp:46-64) resolves no index `>= item_count`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';
import { ruleCount } from '../../../linter/validators/commonValidators.js';
import { indexedElements } from '../../../godot/index.js';
import { listIndices } from '../../../linter/reportedIndices.js';

/**
 * The family's prefix. It is a `PropertyListHelper` one
 * (popup_menu.cpp:3319-3328), whose `_get_property` gates the index on
 * `String::is_valid_int()` (property_list_helper.cpp:53).
 */
const ITEM_PREFIX = 'item_';

// `p_allow_oob` is false: `enable_out_of_bounds_assign()` (property_list_helper.h:92)
// has one caller, tab_container.cpp:1294. `PopupMenu::_set` (popup_menu.cpp:3091-3094)
// goes through `property_set_value` (property_list_helper.cpp:166-175), which drops
// the write with no log: the dropped write ADR-0032 grounds a diagnostic on.

// Godot's saver never writes this: `item_count` (`ADD_ARRAY_COUNT`, popup_menu.cpp:3267)
// precedes the item leaves, and `items.resize(p_count)` (popup_menu.cpp:2718) keeps
// them in step. Only a hand-edited scene fires it.
function checkPopupMenu(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;
  if (!isValidProperties(node.properties)) return diagnostics;
  const rawProps = node.properties as Record<string, string>;

  const countRaw = rawProps.item_count;
  // Absent means the default 0 (doc/classes/PopupMenu.xml), which the
  // serialiser omits: an empty `Vector<Item> items`, so every item key is out
  // of range.
  const count = ruleCount(countRaw);
  // A malformed item_count already draws its own validator's diagnostic, and a
  // non-finite one is altered at parse to a number the file does not state, so
  // neither is a count this rule can name in a message.
  if (count === null) return diagnostics;

  // `indexedElements`, not a hand-rolled key scan: it resolves the index the way
  // `_get_property` does and skips a key with no leaf, such as `item_3/`. The
  // dispatcher in linterParser.ts reports a negative index, so this checks only the
  // high end, and one mistake gets one diagnostic.
  const offending = [...indexedElements(rawProps, ITEM_PREFIX, 'is_valid_int').keys()]
    .filter((index) => index >= count)
    .sort((a, b) => a - b);
  if (offending.length === 0) return diagnostics;

  const indices = listIndices(offending);
  diagnostics.push({
    severity: 'error',
    message:
      `PopupMenu item index(es) ${indices} fall outside item_count (${count}). ` +
      'PropertyListHelper::_get_property (property_list_helper.cpp:58) returns null for ' +
      'an index >= the array length, so PopupMenu never calls the matching setter and ' +
      'these item_<N>/… values are silently dropped on load.',
    nodeName: node.name,
    nodeType: node.type,
    ruleName: 'popupmenu-item-index-out-of-range',
  });

  return diagnostics;
}

const popupMenuValidationRule: LintRule = {
  meta: {
    name: 'valid-popupmenu-properties',
    description: "Validates PopupMenu's dynamic item_<N>/… indices stay within item_count",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'PopupMenu'),
    emits: [
      {
        ruleName: 'popupmenu-item-index-out-of-range',
        severity: 'error',
        grounding: { kind: 'engine', at: 'property_list_helper.cpp:58' },
      },
    ],
  },
  check: checkPopupMenu,
};

ruleRegistry.register(popupMenuValidationRule);

export { popupMenuValidationRule };
