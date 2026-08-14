/**
 * OptionButton cross-field advisory: `selected` against `item_count`.
 *
 * Format validation (including `selected`'s own -1 floor) is handled by
 * linterParser.ts. This rule catches what a single-property validator
 * cannot: `selected` naming an index that `item_count` never provides.
 *
 * The engine-grounded reason this is worth flagging, not just "seems wrong":
 * `ADD_PROPERTY(PropertyInfo(Variant::INT, "selected"), "_select_int", ...)`
 * (option_button.cpp:601) routes every scene-loaded `selected` write through
 * `OptionButton::_select_int` (option_button.cpp:432-443). Its outcome
 * depends on which of `selected`/`item_count` SceneState applies FIRST, an
 * ordering this rule's `node.properties` bag cannot see (it holds only the
 * final key/value pairs):
 *
 * - `selected` applied first — which is Godot's OWN writer order; a packed
 *   OptionButton saves `selected` above `item_count`. `initialized` is still
 *   false, so the `p_which >= popup->get_item_count()` branch stashes the
 *   value in `queued_current` (option_button.cpp:437-438), and the later
 *   `set_item_count` assigns it straight to `current`
 *   (option_button.cpp:329-334) with NO bounds check at all, bypassing the
 *   `ERR_FAIL_INDEX` that guards every other path into `_select`
 *   (option_button.cpp:416). `current` ends up permanently out of range, and
 *   `get_selected()`/`get_selected_id()` return it as-is.
 * - `item_count` applied first: by the time `selected` lands, `initialized`
 *   is already true, so the SAME branch just returns, the write is silently
 *   dropped and `current` keeps its previous value
 *   (option_button.cpp:436-441).
 *
 * Neither outcome selects the intended item, so this reports regardless of
 * which shape a real file turns out to be. Warning rather than error, and
 * this is the ADR-0032 reading that decides it: in the canonical order the
 * authored value is neither refused nor altered — it is stored verbatim, and
 * only unusable. The refusal exists solely in the other order, so the error
 * tier is not available to a rule that cannot see which order applies.
 */

import type { Diagnostic, LintRule, RuleContext } from '../../../../linter/types.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { parseGodotInt } from '../../../../linter/validators/commonValidators.js';

function checkOptionButtonSelected(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const props = node.properties as Record<string, string>;

  if (props.selected === undefined) return [];
  const selected = parseGodotInt(props.selected);
  // -1 ("none selected") and below are the single-property validator's own
  // concern; this rule only compares a NON-NEGATIVE selected index against
  // the sibling item_count. A non-finite reads as NaN, which no comparison
  // places on the number line and which the message must never print.
  if (selected === null || Number.isNaN(selected) || selected < 0) return [];

  const itemCount = props.item_count !== undefined ? parseGodotInt(props.item_count) : 0;
  if (itemCount === null || Number.isNaN(itemCount)) return [];

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
