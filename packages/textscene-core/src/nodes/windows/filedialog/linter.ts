/**
 * Semantic linter rule for FileDialog.
 *
 * Format validation is handled by linterParser.ts, which does validate each
 * `option_<N>/<leaf>` in isolation. This file holds what that cannot see: the
 * index itself is only meaningful relative to a SIBLING property. Each leaf is
 * served through a `PropertyListHelper`
 * (file_dialog.cpp:169-170, 2199-2204, 2627), and
 * `PropertyListHelper::_get_property` (property_list_helper.cpp:46-64) refuses
 * to resolve ANY `option_<N>/…` key whose index is negative or `>=` the
 * dialog's current `option_count`:
 *
 *   int index = index_string.to_int();
 *   if (index < 0 || (!p_allow_oob && index >= _call_array_length_getter())) {
 *     return nullptr;
 *   }
 *
 * FileDialog never calls `PropertyListHelper::enable_out_of_bounds_assign()`,
 * so `p_allow_oob` is always false here. `FileDialog::_set` (file_dialog.h:386)
 * is `return property_helper.property_set_value(p_name, p_value);`, and
 * `property_set_value` (property_list_helper.cpp:166-175) returns false for an
 * out-of-range index: the write never reaches `set_option_name`/
 * `set_option_values`/`set_option_default`, with no error surfaced anywhere,
 * exactly the "silently dropped write" case ADR-0032 grounds a diagnostic on.
 *
 * Godot's own saver can never produce this: `option_count` is a ClassDB-bound
 * property (`ADD_ARRAY_COUNT`), so `Object::get_property_list` always places
 * it ahead of the `_get_property_list`-appended `option_<N>/…` leaves
 * (object.h's GDCLASS-generated `_get_property_listv`: the class's own
 * `_get_property_list_from_classdb` call precedes its `_get_property_list`
 * override), and `options.resize(p_count)` keeps the two in lockstep at
 * runtime, so this only ever fires against a hand-edited scene where an
 * `option_<N>/…` line outran (or was never matched by) `option_count`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';
import { ruleInt } from '../../../linter/validators/commonValidators.js';

const OPTION_KEY_RE = /^option_(-?\d+)\//;

function checkFileDialog(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;
  if (!isValidProperties(node.properties)) return diagnostics;
  const rawProps = node.properties as Record<string, string>;

  const countRaw = rawProps.option_count;
  // Godot's own default (no ADD_PROPERTY default listed beyond the XML's
  // `default="0"`, matching the empty `Vector<Option> options` the class
  // constructs with) is 0 when the property never serialised at all.
  const count = ruleInt(countRaw, 0);
  // A malformed option_count is already reported by its own validator
  // (linterParser.ts), and a non-finite one is altered at parse to a number the
  // file does not state; neither is a count this rule can name in a message.
  if (count === null) return diagnostics;

  const offending = new Set<number>();
  for (const key of Object.keys(rawProps)) {
    const match = OPTION_KEY_RE.exec(key);
    if (!match) continue;
    const index = Number(match[1]);
    if (index < 0 || index >= count) offending.add(index);
  }
  if (offending.size === 0) return diagnostics;

  const indices = [...offending].sort((a, b) => a - b).join(', ');
  diagnostics.push({
    severity: 'error',
    message:
      `FileDialog option index(es) ${indices} fall outside option_count (${count}). ` +
      `PropertyListHelper::_get_property (property_list_helper.cpp:58) returns null for ` +
      'an index that is negative or >= the array length, so FileDialog never calls the ' +
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
