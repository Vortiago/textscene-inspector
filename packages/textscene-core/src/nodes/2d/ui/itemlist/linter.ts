/**
 * Semantic linter rule for ItemList.
 *
 * Format validation lives in linterParser.ts, which does check each
 * `item_<N>/<leaf>` in isolation. This file holds the one thing that cannot
 * see: the index is only meaningful relative to a SIBLING property. The four
 * per-item leaves are served through a `PropertyListHelper`
 * (item_list.cpp:2461-2466), and `PropertyListHelper::_get_property`
 * (property_list_helper.cpp:46-64) refuses to resolve any `item_<N>/…` key
 * whose index is negative or `>=` the list's current `item_count`:
 *
 *   int index = index_string.to_int();
 *   if (index < 0 || (!p_allow_oob && index >= _call_array_length_getter())) {
 *     return nullptr;
 *   }
 *
 * `p_allow_oob` is always false here: `enable_out_of_bounds_assign()` has
 * exactly one caller in the engine (tab_container.cpp:1294) and ItemList is not
 * it. `ItemList::_set` (item_list.cpp:2237-2240) starts with
 * `property_helper.property_set_value(...)`, and `property_set_value`
 * (property_list_helper.cpp:166-175) returns false for an unresolved index, so
 * the write never reaches `set_item_text` / `set_item_icon` /
 * `set_item_selectable` / `set_item_disabled`. Nothing is logged: it is the
 * silently dropped write ADR-0032 grounds a diagnostic on.
 *
 * Only the HIGH end is checked here. The negative end is already reported by
 * the family dispatcher in linterParser.ts, which has everything it needs to
 * see it, and reporting it twice would double the diagnostic for one mistake.
 *
 * Godot's own saver can never produce this: `item_count` is a ClassDB-bound
 * property (`ADD_ARRAY_COUNT` at item_list.cpp:2403), so
 * `Object::get_property_list` always places it ahead of the
 * `_get_property_list`-appended `item_<N>/…` leaves, and `items.resize(p_count)`
 * (item_list.cpp:542) keeps the two in lockstep at runtime. It fires only
 * against a hand-edited scene where an `item_<N>/…` line outran the count.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';

const ITEM_KEY_RE = /^item_(-?\d+)\//;

function checkItemList(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;
  if (!isValidProperties(node.properties)) return diagnostics;
  const rawProps = node.properties as Record<string, string>;

  const countRaw = rawProps.item_count;
  // Absent means the default 0 (doc/classes/ItemList.xml), which the serialiser
  // omits: an empty `Vector<Item> items`, so every item key is out of range.
  const count = countRaw === undefined ? 0 : parseInt(countRaw, 10);
  // A malformed item_count already draws its own validator's diagnostic; this
  // rule only reasons about a value that parsed.
  if (Number.isNaN(count)) return diagnostics;

  const offending = new Set<number>();
  for (const key of Object.keys(rawProps)) {
    const match = ITEM_KEY_RE.exec(key);
    if (!match) continue;
    const index = Number(match[1]);
    // Negative indices belong to the dispatcher; see the header.
    if (index >= 0 && index >= count) offending.add(index);
  }
  if (offending.size === 0) return diagnostics;

  const indices = [...offending].sort((a, b) => a - b).join(', ');
  diagnostics.push({
    severity: 'warning',
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
        severity: 'warning',
        grounding: { kind: 'engine', at: 'property_list_helper.cpp:58' },
      },
    ],
  },
  check: checkItemList,
};

ruleRegistry.register(itemListValidationRule);

export { itemListValidationRule };
