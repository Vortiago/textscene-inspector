/**
 * Warns when `selected` names an index `item_count` never provides. Loaded writes go through
 * `_select_int` (option_button.cpp:601, option_button.cpp:432-443). With `selected` first, Godot's own save
 * order, `set_item_count` stores it unchecked (option_button.cpp:437-438, option_button.cpp:329-334), past
 * `_select`'s `ERR_FAIL_INDEX` (option_button.cpp:416). With `item_count` first, the write drops (option_button.cpp:436-441).
 */

import type { Diagnostic, LintRule, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { ruleCount, ruleInt } from '../../../../linter/validators/commonValidators.js';
import { armDiagnostic, armEmits, type RuleArms } from '../../../../linter/ruleArms.js';
import { pastCountDiagnostic } from '../../../../linter/reportedIndices.js';
import { OPTION_BUTTON_ITEMS } from '../../../../godot/classdb/propertyListFamilies.js';

const arms = {
  selectedOutOfRange: {
    severity: 'warning',
    ruleName: 'optionbutton-selected-out-of-range',
    grounding: { kind: 'engine', at: 'option_button.cpp:436' },
  },
  itemIndexOutOfRange: {
    severity: 'error',
    ruleName: 'optionbutton-item-index-out-of-range',
    grounding: { kind: 'engine', at: OPTION_BUTTON_ITEMS.outOfBounds.at },
  },
} as const satisfies RuleArms<string>;

/**
 * A `popup/item_<N>` key at or past `item_count`. `_set` gates on `is_property_valid`, which checks no
 * length (property_list_helper.cpp:118-135), and forwards to the popup (option_button.cpp:168), whose
 * helper drops the write (property_list_helper.cpp:58). linterParser.ts reports a negative index.
 */
function checkItemIndices({ node }: RuleContext): Diagnostic[] {
  const diagnostic = pastCountDiagnostic(
    node,
    OPTION_BUTTON_ITEMS,
    arms.itemIndexOutOfRange,
    (indices, count) =>
      `OptionButton item index(es) ${indices} fall outside item_count (${count}). ` +
      'OptionButton forwards the write to its popup (option_button.cpp:168), whose ' +
      'PropertyListHelper::_get_property (property_list_helper.cpp:58) returns null for an ' +
      'index >= the array length, so no setter runs and these popup/item_<N>/… values are ' +
      'silently dropped on load.'
  );
  return diagnostic ? [diagnostic] : [];
}

function checkSelected(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const props = node.rawProperties;

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
    armDiagnostic(
      arms.selectedOutOfRange,
      node,
      `OptionButton '${node.name}' sets 'selected' = ${selected} but declares only ${itemCount} item(s) (item_count). Depending on the order these two properties appear in the file, Godot either silently drops this selection (option_button.cpp:436-441) or assigns it to the internal current index with no bounds check at all (option_button.cpp:329-334); neither selects the intended item.`
    ),
  ];
}

function checkOptionButton(context: RuleContext): Diagnostic[] {
  return [...checkSelected(context), ...checkItemIndices(context)];
}

const optionButtonRule: LintRule = {
  meta: {
    name: 'valid-optionbutton-properties',
    description: "Flags an OptionButton 'selected' or popup/item_<N> index that item_count never provides",
    category: 'validation',
    applicableNodeTypes: [OPTION_BUTTON_ITEMS.owner],
    emits: armEmits(arms),
  },
  check: checkOptionButton,
};

ruleRegistry.register(optionButtonRule);
