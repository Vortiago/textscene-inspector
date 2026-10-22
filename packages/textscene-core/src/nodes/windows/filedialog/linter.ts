/**
 * FileDialog's rule: an `option_<N>/…` index at or past `option_count`. The leaves
 * go through a `PropertyListHelper` (file_dialog.cpp:169-170, 2199-2204, 2627) with no
 * out-of-bounds assign, so `_get_property` (property_list_helper.cpp:46-64) resolves none and
 * `_set` (file_dialog.h:386, property_list_helper.cpp:166-175) drops the write silently.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes.js';
import { pastCountDiagnostic } from '../../../linter/reportedIndices.js';
import { FILE_DIALOG_OPTIONS } from '../../../godot/classdb/propertyListFamilies.js';
import { armEmits, type RuleArms } from '../../../linter/ruleArms.js';

const arms = {
  optionIndexOutOfRange: {
    severity: 'error',
    ruleName: 'filedialog-option-index-out-of-range',
    grounding: { kind: 'engine', at: FILE_DIALOG_OPTIONS.outOfBounds.at },
  },
} as const satisfies RuleArms<string>;

// Godot's saver never writes this: `option_count` (`ADD_ARRAY_COUNT`) precedes
// the leaves (object.h, `_get_property_listv`) and `options.resize(p_count)`
// keeps them in step, so only a hand edit reaches here.
function checkFileDialog({ node }: RuleContext): Diagnostic[] {
  // An absent `option_count` is Godot's default 0, the empty `Vector<Option> options` the class
  // constructs with. A key with no leaf, such as `option_3/`, names no option. A negative index is
  // the dispatcher's branch in linterParser.ts, so one refusal is not reported twice.
  return pastCountDiagnostic(
    node,
    FILE_DIALOG_OPTIONS,
    arms.optionIndexOutOfRange,
    (indices, count) =>
      `FileDialog option index(es) ${indices} fall outside option_count (${count}). ` +
      `PropertyListHelper::_get_property (property_list_helper.cpp:58) returns null for ` +
      'an index >= the array length, so FileDialog never calls the ' +
      'matching setter and these option_<N>/… values are silently dropped on load.'
  );
}

const fileDialogValidationRule: LintRule = {
  meta: {
    name: 'valid-filedialog-properties',
    description: "Validates FileDialog's dynamic option_<N>/… indices stay within option_count",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFromClass(nodeType, FILE_DIALOG_OPTIONS.owner),
    emits: armEmits(arms),
  },
  check: checkFileDialog,
};

ruleRegistry.register(fileDialogValidationRule);
