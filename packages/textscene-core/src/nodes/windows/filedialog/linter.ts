/**
 * FileDialog's rule: an `option_<N>/…` index at or past `option_count`. The leaves
 * go through a `PropertyListHelper` (file_dialog.cpp:169-170, 2199-2204, 2627) with no
 * out-of-bounds assign, so `_get_property` (property_list_helper.cpp:46-64) resolves none and
 * `_set` (file_dialog.h:386, property_list_helper.cpp:166-175) drops the write silently.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';
import { ruleCount } from '../../../linter/validators/commonValidators.js';
import { indicesPastCount, listWrittenIndices } from '../../../linter/reportedIndices.js';

/**
 * FileDialog serves the family through a `PropertyListHelper` (file_dialog.cpp),
 * whose `_get_property` gates on `String::is_valid_int()`
 * (property_list_helper.cpp:53).
 */
const OPTION_PREFIX = 'option_';

function checkFileDialog(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;
  if (!isValidProperties(node.properties)) return diagnostics;
  const rawProps = node.properties as Record<string, string>;

  const countRaw = rawProps.option_count;
  // An absent `option_count` is Godot's default 0 (the XML's `default="0"`, the
  // empty `Vector<Option> options` the class constructs with).
  const count = ruleCount(countRaw);
  // A malformed option_count is already reported by its own validator
  // (linterParser.ts), and a non-finite one is altered at parse to a number the
  // file does not state. Neither is a count this rule can name in a message.
  if (count === null) return diagnostics;

  // Resolved as `_get_property` resolves it, so a key with no leaf, such as
  // `option_3/`, names no option. Only the `>= option_count` half is this rule's:
  // a negative index is the dispatcher's branch in linterParser.ts, so one refusal
  // is not reported twice.
  const offending = indicesPastCount(rawProps, OPTION_PREFIX, 'is_valid_int', count);
  if (offending.size === 0) return diagnostics;

  // Godot's saver never writes this: `option_count` (`ADD_ARRAY_COUNT`) precedes
  // the leaves (object.h, `_get_property_listv`) and `options.resize(p_count)`
  // keeps them in step, so only a hand edit reaches here.
  const indices = listWrittenIndices(offending);
  diagnostics.push({
    severity: 'error',
    message:
      `FileDialog option index(es) ${indices} fall outside option_count (${count}). ` +
      `PropertyListHelper::_get_property (property_list_helper.cpp:58) returns null for ` +
      'an index >= the array length, so FileDialog never calls the ' +
      "matching setter and these option_<N>/… values are silently dropped on load.",
    nodeName: node.name,
    nodeType: node.type,
    ruleName: 'filedialog-option-index-out-of-range',
  });

  return diagnostics;
}

const fileDialogValidationRule: LintRule = {
  meta: {
    name: 'valid-filedialog-properties',
    description: "Validates FileDialog's dynamic option_<N>/… indices stay within option_count",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'FileDialog'),
    emits: [
      {
        ruleName: 'filedialog-option-index-out-of-range',
        severity: 'error',
        grounding: { kind: 'engine', at: 'property_list_helper.cpp:58' },
      },
    ],
  },
  check: checkFileDialog,
};

ruleRegistry.register(fileDialogValidationRule);

export { fileDialogValidationRule };
