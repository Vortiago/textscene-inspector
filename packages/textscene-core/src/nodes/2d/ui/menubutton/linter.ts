/**
 * Semantic linter rule for MenuButton.
 *
 * Format validation lives in linterParser.ts, which checks each
 * `popup/item_<N>/<leaf>` in isolation. This file holds the one thing that
 * cannot see: the index is only meaningful relative to a SIBLING property.
 *
 * MenuButton's own helper does NOT bound the index. `MenuButton::_set`
 * (menu_button.cpp:174-182) gates on `property_helper.is_property_valid`, and
 * that checks the prefix, `String::is_valid_int()` and the leaf name and
 * nothing else (property_list_helper.cpp:118-135) — no array-length test at
 * all. It then forwards the raw write:
 *
 *   popup->set(sname.trim_prefix("popup/"), p_value, &valid);
 *   return valid;
 *
 * which lands in `PopupMenu::_set` (popup_menu.cpp:3091) and its
 * `property_helper.property_set_value`, where `_get_property` DOES refuse an
 * index at or past the array length (property_list_helper.cpp:58). The count it
 * measures against is the popup's: `MenuButton::get_item_count`
 * (menu_button.cpp:134-135) returns `popup->get_item_count()`, and
 * `set_item_count` (menu_button.cpp:123-131) forwards to
 * `popup->set_item_count(p_count)`. So the write is dropped, `valid` comes back
 * false, and nothing is logged — the silently dropped write ADR-0032 grounds a
 * diagnostic on.
 *
 * Only the HIGH end is checked here. The negative end is already reported by
 * the family dispatcher in linterParser.ts, which has everything it needs to
 * see it, and reporting it twice would double the diagnostic for one mistake.
 *
 * Godot's own saver can never produce this: `item_count` is a ClassDB-bound
 * property (`ADD_ARRAY_COUNT` at menu_button.cpp:205), so
 * `Object::get_property_list` always places it ahead of the
 * `_get_property_list`-appended `popup/item_<N>/…` leaves. It fires only against
 * a hand-edited scene where an item line outran the count.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { ruleCount } from '../../../../linter/validators/commonValidators.js';
import { indexedElements } from '../../../../godot/index.js';
import { listIndices } from '../../../../linter/reportedIndices.js';

const RULE_NAME = 'menubutton-item-index-out-of-range';

/**
 * The family prefix is `popup/item_` (menu_button.cpp:213) while the count key
 * is the bare `item_count` (menu_button.cpp:205) — the two do not share a
 * spelling, and a bare `item_0/text` reaches no MenuButton property at all.
 */
const ITEM_PREFIX = 'popup/item_';

function checkMenuButton(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const rawProps = node.properties as Record<string, string>;

  // Absent means 0: the popup starts with an empty `Vector<Item> items`, which
  // is doc/classes/MenuButton.xml's default="0" and what the serialiser omits.
  const count = ruleCount(rawProps.item_count);
  // A malformed item_count already draws its own validator's diagnostic, and a
  // non-finite one is altered at parse to a number the file does not state, so
  // neither is a count this rule can name in a message.
  if (count === null) return [];

  const offending = [...indexedElements(rawProps, ITEM_PREFIX, 'is_valid_int').keys()]
    .filter((index) => index >= count)
    .sort((a, b) => a - b);
  if (offending.length === 0) return [];

  return [
    {
      severity: 'error',
      message:
        `MenuButton item index(es) ${listIndices(offending)} fall outside item_count (${count}). ` +
        'MenuButton forwards the write to its popup child (menu_button.cpp:178), whose ' +
        'PropertyListHelper::_get_property (property_list_helper.cpp:58) returns null for an ' +
        'index >= the array length, so no setter runs and these popup/item_<N>/… values are ' +
        'silently dropped on load.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: RULE_NAME,
    },
  ];
}

const menuButtonValidationRule: LintRule = {
  meta: {
    name: 'valid-menubutton-properties',
    description: "Validates MenuButton's dynamic popup/item_<N>/… indices stay within item_count",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'MenuButton'),
    emits: [
      {
        ruleName: RULE_NAME,
        severity: 'error',
        grounding: { kind: 'engine', at: 'property_list_helper.cpp:58' },
      },
    ],
  },
  check: checkMenuButton,
};

ruleRegistry.register(menuButtonValidationRule);

export { menuButtonValidationRule };
