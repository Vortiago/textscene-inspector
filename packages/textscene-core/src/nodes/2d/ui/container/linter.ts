/**
 * Semantic linter rule for Container — Godot's own configuration warning,
 * `Container::get_configuration_warnings()` (container.cpp:207-214):
 *
 *     PackedStringArray warnings = Control::get_configuration_warnings();
 *     if (get_class() == "Container" && get_script().is_null()) {
 *         warnings.push_back(RTR("Container by itself serves no purpose unless a
 *             script configures its children placement behavior.\nIf you don't
 *             intend to add a script, use a plain Control node instead."));
 *     }
 *     return warnings;
 *
 * `get_class() == "Container"` is an EXACT-class test, not `is_class` — a
 * `VBoxContainer` or any of the other ~23 concrete descendants never reaches
 * this line, since each overrides `get_class()` to its own name. So the rule
 * below deliberately does NOT use `applicableNodeTypeMatcher`: exact-match on
 * `'Container'` is not a limitation here, it is what the engine itself does.
 *
 * The second half of the guard, `get_script().is_null()`, is easy to miss
 * reading the message alone: a bare Container WITH a script attached (the
 * intended use — the script implements `_get_allowed_size_flags_*`/sorts
 * children in `NOTIFICATION_SORT_CHILDREN`) never warns. The trigger is an EMPTY
 * slot, not an absent key: `variant_parser.cpp:699` reads `null`/`nil` to
 * `Variant()`, `Object::set_script` leaves `script_instance` null for it
 * (object.cpp:1092-1107), and `get_script()` (object.cpp:1134-1136) then answers
 * `is_null()` exactly as it does for an absent key — so the engine warns for
 * both, and `resourceSlotIsEmpty` is what holds the spellings to one answer.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { resourceSlotIsEmpty } from '../../../../linter/resourceChecker.js';

function checkContainer(context: RuleContext): Diagnostic[] {
  const { node } = context;

  const props = isValidProperties(node.properties) ? node.properties : {};
  if (!resourceSlotIsEmpty(props.script)) return [];

  return [
    {
      severity: 'warning',
      message: `Container '${node.name}' serves no purpose by itself unless a script configures its children's placement. If you don't intend to add a script, use a plain Control node instead.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'container-no-script',
    },
  ];
}

const containerScriptRule: LintRule = {
  meta: {
    name: 'valid-container-script',
    description:
      'Flags a plain Container (the exact class, not a subclass) with no script attached — it places no children on its own',
    category: 'validation',
    exactClassByDesign: 'container.cpp:210',
    applicableNodeTypes: ['Container'],
    emits: [{ ruleName: 'container-no-script', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkContainer,
};

ruleRegistry.register(containerScriptRule);

export { containerScriptRule };
