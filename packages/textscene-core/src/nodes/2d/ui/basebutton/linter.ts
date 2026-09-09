/**
 * The BaseButton dead-ButtonGroup rule, shared by every BaseButton subclass.
 *
 * Godot states it itself: `BaseButton::get_configuration_warnings`
 * (scene/gui/base_button.cpp:522-529) warns when a button carries a
 * `button_group` while `toggle_mode` is false, because a ButtonGroup only ever
 * arbitrates between toggled buttons — grouping non-toggle buttons silently
 * does nothing.
 *
 * The subtlety is the default. Godot omits a property it is serialising at its
 * default, so an absent `toggle_mode` does NOT mean false: five subclasses flip
 * it in their constructor (check_box.cpp:172, check_button.cpp:171,
 * option_button.cpp:652, menu_button.cpp:240, color_picker.cpp:2551), and
 * doc/classes/ records that as `overrides="BaseButton" default="true"`. Reading
 * absence as false would warn on every grouped CheckBox in existence.
 *
 * ONE rule on the tier rather than one per subclass: `applicableNodeTypeMatcher`
 * reaches every descendant through the base chain, so the leaf slices declare
 * nothing and a new button type is covered the day it is added.
 */

import type { Diagnostic, LintRule, RuleContext } from '../../../../linter/types.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { resourceSlotIsEmpty } from '../../../../linter/resourceChecker.js';
import { boolSlotValue } from '../../../../godot/index.js';

/** Subclasses whose constructor sets toggle_mode, so absence means true. */
const TOGGLE_MODE_ON_BY_DEFAULT = new Set([
  'CheckBox',
  'CheckButton',
  'ColorPickerButton',
  'MenuButton',
  'OptionButton',
]);

function isButton(nodeType: string): boolean {
  return descendsFrom(nodeType, 'BaseButton');
}

function checkButtonGroup(context: RuleContext): Diagnostic[] {
  const { node } = context;

  const props = node.properties as Record<string, string>;

  // An absent, empty or explicitly cleared reference is how Godot serialises
  // "no group", and `get_button_group().is_valid()` (base_button.cpp:525) is
  // false for all three.
  if (resourceSlotIsEmpty(props.button_group)) return [];

  const toggleMode =
    props.toggle_mode === undefined
      ? TOGGLE_MODE_ON_BY_DEFAULT.has(node.type)
      : boolSlotValue(props.toggle_mode) === true;
  if (toggleMode) return [];

  return [
    {
      severity: 'warning',
      message: `${node.type} '${node.name}' sets 'button_group' but leaves 'toggle_mode' false. A ButtonGroup only arbitrates between toggle buttons, so the group has no effect.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'button-group-without-toggle-mode',
    },
  ];
}

const buttonGroupRule: LintRule = {
  meta: {
    name: 'valid-button-group',
    description: 'Flags a ButtonGroup on a button that is not in toggle mode',
    category: 'validation',
    applicableNodeTypeMatcher: isButton,
    emits: [{ ruleName: 'button-group-without-toggle-mode', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkButtonGroup,
};

ruleRegistry.register(buttonGroupRule);

export { buttonGroupRule };
