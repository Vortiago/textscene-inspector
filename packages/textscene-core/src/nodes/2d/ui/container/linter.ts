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
 * children in `NOTIFICATION_SORT_CHILDREN`) never warns. A `.tscn` only ever
 * shows a script as present or absent — Godot never serialises a script
 * property at a "null" value — so absence of the `script` key IS the trigger.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';

function checkContainer(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (node.type !== 'Container') return [];

  const props = isValidProperties(node.properties) ? node.properties : {};
  if (props.script !== undefined) return [];

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
    emits: [{ ruleName: 'container-no-script', severity: 'warning' }],
  },
  check: checkContainer,
};

ruleRegistry.register(containerScriptRule);

export { containerScriptRule };
