/**
 * Semantic linter rule for PopupMenu.
 *
 * Format validation lives in linterParser.ts, which checks each
 * `item_<N>/<leaf>` in isolation. This file holds the one thing that cannot
 * see: the index is only meaningful relative to a SIBLING property. The seven
 * per-item leaves are served through a `PropertyListHelper`
 * (popup_menu.cpp:3319-3328), and `PropertyListHelper::_get_property`
 * (property_list_helper.cpp:46-64) refuses to resolve any `item_<N>/…` key
 * whose index is negative or `>=` the menu's current `item_count`:
 *
 *   int index = index_string.to_int();
 *   if (index < 0 || (!p_allow_oob && index >= _call_array_length_getter())) {
 *     return nullptr;
 *   }
 *
 * `p_allow_oob` is always false here: `enable_out_of_bounds_assign()`
 * (property_list_helper.h:92) has exactly one caller in the engine
 * (tab_container.cpp:1294) and PopupMenu is not it. `PopupMenu::_set`
 * (popup_menu.cpp:3091-3094) opens with
 * `property_helper.property_set_value(...)`, and `property_set_value`
 * (property_list_helper.cpp:166-175) returns false for an unresolved index, so
 * the write never reaches `set_item_text` / `set_item_icon` /
 * `_set_item_checkable_type` / `set_item_checked` / `set_item_id` /
 * `set_item_disabled` / `set_item_as_separator`. Nothing is logged: it is the
 * silently dropped write ADR-0032 grounds a diagnostic on.
 *
 * Only the HIGH end is checked here. The negative end is already reported by
 * the family dispatcher in linterParser.ts, which has everything it needs to
 * see it, and reporting it twice would double the diagnostic for one mistake.
 *
 * Godot's own saver can never produce this: `item_count` is a ClassDB-bound
 * property (`ADD_ARRAY_COUNT` at popup_menu.cpp:3267), so
 * `Object::get_property_list` always places it ahead of the
 * `_get_property_list`-appended `item_<N>/…` leaves, and `items.resize(p_count)`
 * (popup_menu.cpp:2718) keeps the two in lockstep at runtime. It fires only
 * against a hand-edited scene where an `item_<N>/…` line outran the count.
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
  // `_get_property` does and skips a key with no leaf, which `item_3/` is. The
  // twin rule on MenuButton already reads its family through it, and the two
  // disagreed on exactly that shape. Negative indices belong to the dispatcher;
  // see the header.
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
