/**
 * Errors when a `popup/item_<N>/...` index reaches `item_count`. `MenuButton::_set` (menu_button.cpp:174-182)
 * checks only prefix, int and leaf (property_list_helper.cpp:118-135), then forwards to `PopupMenu::_set`
 * (popup_menu.cpp:3091), whose helper silently drops an index at or past the array length
 * (property_list_helper.cpp:58). ADR-0032 grounds a diagnostic on that dropped write.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFromClass } from '../../../../godot/classdb/classBaseTypes.js';
import { listWrittenIndices, writesPastFamilyCount } from '../../../../linter/reportedIndices.js';
import { MENU_BUTTON_ITEMS } from '../../../../godot/classdb/propertyListFamilies.js';
import { armDiagnostic, armEmits, type RuleArms } from '../../../../linter/ruleArms.js';

const arms = {
  itemIndexOutOfRange: {
    severity: 'error',
    ruleName: 'menubutton-item-index-out-of-range',
    grounding: { kind: 'engine', at: 'property_list_helper.cpp:58' },
  },
} as const satisfies RuleArms<string>;

function checkMenuButton(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const rawProps = node.rawProperties;

  // `item_count` is the popup's (menu_button.cpp:123-131, menu_button.cpp:134-135) and the key is the bare
  // `item_count`, so `item_0/text` reaches no MenuButton property. Absent means 0: the popup starts with an
  // empty `Vector<Item> items`. Godot's saver writes the count first, so only a hand-edited scene fires this
  // rule, and only the high end: linterParser.ts's family dispatcher reports a negative index.
  const pastCount = writesPastFamilyCount(rawProps, MENU_BUTTON_ITEMS);
  if (pastCount === null || pastCount.offending.size === 0) return [];
  const { count, offending } = pastCount;

  return [
    armDiagnostic(
      arms.itemIndexOutOfRange,
      node,
      `MenuButton item index(es) ${listWrittenIndices(offending)} fall outside item_count (${count}). ` +
        'MenuButton forwards the write to its popup child (menu_button.cpp:178), whose ' +
        'PropertyListHelper::_get_property (property_list_helper.cpp:58) returns null for an ' +
        'index >= the array length, so no setter runs and these popup/item_<N>/… values are ' +
        'silently dropped on load.'
    ),
  ];
}

const menuButtonValidationRule: LintRule = {
  meta: {
    name: 'valid-menubutton-properties',
    description: "Validates MenuButton's dynamic popup/item_<N>/… indices stay within item_count",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFromClass(nodeType, 'MenuButton'),
    emits: armEmits(arms),
  },
  check: checkMenuButton,
};

ruleRegistry.register(menuButtonValidationRule);
