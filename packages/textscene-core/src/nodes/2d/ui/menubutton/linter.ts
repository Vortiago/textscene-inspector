/**
 * Errors when a `popup/item_<N>/...` index reaches `item_count`. `MenuButton::_set` (menu_button.cpp:174-182)
 * checks only prefix, int and leaf (property_list_helper.cpp:118-135), then forwards to `PopupMenu::_set`
 * (popup_menu.cpp:3091), whose helper silently drops an index at or past the array length
 * (property_list_helper.cpp:58). ADR-0032 grounds a diagnostic on that dropped write.
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
 * The family prefix is `popup/item_` (menu_button.cpp:213) and the count key is the bare `item_count`
 * (`ADD_ARRAY_COUNT` at menu_button.cpp:205), so `item_0/text` reaches no MenuButton property. Godot's
 * saver writes the count first, so only a hand-edited scene fires this rule.
 */
const ITEM_PREFIX = 'popup/item_';

function checkMenuButton(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const rawProps = node.properties as Record<string, string>;

  // `item_count` is the popup's (menu_button.cpp:123-131, menu_button.cpp:134-135). Absent means 0: the popup
  // starts with an empty `Vector<Item> items`, doc/classes/MenuButton.xml's default="0" the serialiser omits.
  const count = ruleCount(rawProps.item_count);
  // A malformed item_count draws its own validator's diagnostic, and a non-finite one parses to a
  // number the file does not state, so this rule cannot name either in a message.
  if (count === null) return [];

  // Only the high end: linterParser.ts's family dispatcher already reports a negative index.
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
