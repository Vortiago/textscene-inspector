/**
 * The configuration warning of `Container::get_configuration_warnings()`
 * (container.cpp:207-214): `get_class() == "Container" && get_script().is_null()`.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { resourceSlotIsEmpty } from '../../../../linter/resourceChecker.js';

function checkContainer(context: RuleContext): Diagnostic[] {
  const { node } = context;

  // `null` reads to `Variant()` (variant_parser.cpp:699), `Object::set_script` then leaves no
  // instance (object.cpp:1092-1107), and `get_script()` (object.cpp:1134-1136) is null, as for
  // an absent key. `resourceSlotIsEmpty` gives every spelling that one answer.
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
    // `get_class()`, not `is_class`: each descendant overrides `get_class()`, so
    // only the exact class warns, and `applicableNodeTypeMatcher` would be wrong here.
    exactClassByDesign: 'container.cpp:210',
    applicableNodeTypes: ['Container'],
    emits: [{ ruleName: 'container-no-script', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkContainer,
};

ruleRegistry.register(containerScriptRule);

export { containerScriptRule };
