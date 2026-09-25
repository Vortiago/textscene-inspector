/**
 * Warns when `selected` names an index `item_count` never provides. Loaded writes go through
 * `_select_int` (option_button.cpp:601, option_button.cpp:432-443). With `selected` first, Godot's own save
 * order, `set_item_count` stores it unchecked (option_button.cpp:437-438, option_button.cpp:329-334), past
 * `_select`'s `ERR_FAIL_INDEX` (option_button.cpp:416). With `item_count` first, the write drops (option_button.cpp:436-441).
 */

import type { Diagnostic, LintRule, RuleContext } from '../../../../linter/types.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { ruleCount, ruleInt } from '../../../../linter/validators/commonValidators.js';

function checkOptionButtonSelected(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const props = node.properties as Record<string, string>;

  if (props.selected === undefined) return [];
  const selected = ruleInt(props.selected);
  // -1 ("none selected") and below belong to the single-property validator. A non-finite reads as NaN,
  // which no comparison places and the message must never print.
  if (selected === null || selected < 0) return [];

  const itemCount = ruleCount(props.item_count);
  if (itemCount === null) return [];

  // Warning, not error (ADR-0032): in Godot's save order the value is stored verbatim, only unusable,
  // and the refusal exists only in the other order, which the final property bag cannot show.
  if (selected < itemCount) return [];

  return [
    {
      severity: 'warning',
      message: `OptionButton '${node.name}' sets 'selected' = ${selected} but declares only ${itemCount} item(s) (item_count). Depending on the order these two properties appear in the file, Godot either silently drops this selection (option_button.cpp:436-441) or assigns it to the internal current index with no bounds check at all (option_button.cpp:329-334); neither selects the intended item.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'optionbutton-selected-out-of-range',
    },
  ];
}

const optionButtonSelectedRule: LintRule = {
  meta: {
    name: 'valid-optionbutton-selected',
    description: "Flags an OptionButton 'selected' index that item_count never provides",
    category: 'validation',
    applicableNodeTypes: ['OptionButton'],
    emits: [
      {
        ruleName: 'optionbutton-selected-out-of-range',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'option_button.cpp:436' },
      },
    ],
  },
  check: checkOptionButtonSelected,
};

ruleRegistry.register(optionButtonSelectedRule);

export { optionButtonSelectedRule };
