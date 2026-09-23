/**
 * The dead-ButtonGroup rule (scene/gui/base_button.cpp:522-529): a `button_group` with `toggle_mode`
 * false warns, since a ButtonGroup arbitrates only toggled buttons. One rule on the base tier:
 * `applicableNodeTypeMatcher` reaches every descendant, so a new button type needs no declaration.
 */

import type { Diagnostic, LintRule, RuleContext } from '../../../../linter/types.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { resourceSlotIsEmpty } from '../../../../linter/resourceChecker.js';
import { boolSlotValue } from '../../../../godot/index.js';

/**
 * Subclasses whose constructor sets toggle_mode (check_box.cpp:172, check_button.cpp:171,
 * option_button.cpp:652, menu_button.cpp:240, color_picker.cpp:2551), so absence means true.
 * doc/classes/ records each as `overrides="BaseButton" default="true"`.
 */
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
