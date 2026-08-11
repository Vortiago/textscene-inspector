/**
 * Semantic linter rule for ShaderGlobalsOverride.
 *
 * `ShaderGlobalsOverride::get_configuration_warnings()`
 * (shader_globals_override.cpp:278-286) pushes one warning, at :282: "…is not
 * active because another node of the same type is in the scene." `_activate()`
 * (:228-250) makes only the FIRST node to reach NOTIFICATION_ENTER_TREE join
 * `shader_overrides_group_active`; every other ShaderGlobalsOverride node in the
 * running tree finds that group non-empty and stays inactive for the rest of
 * its life (removing the first only re-activates deferred, at :272).
 *
 * Checkable from a `.tscn` alone only as far as "a conflict exists": which node
 * loses is a TREE-ENTER-order fact, not a document-order one, and an instanced
 * sub-scene can contribute a node this linter never opens. So every instance is
 * warned about once the count is more than one, rather than guessing the winner.
 *
 * Unlike WorldEnvironment, whose winner IS decidable — `get_first_node_in_group`
 * reads a group sorted in tree order, which `firstNodeOfType` reproduces, so its
 * rule exempts the winner. Godot warns only the losers here too
 * (`if (!active)`), so exempting one is the remaining gap; it needs the
 * enter-order model this rule does not have.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { countNodesOfType } from '../../../linter/linterUtils.js';

function checkShaderGlobalsOverride(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const total = countNodesOfType(scene.nodes, 'ShaderGlobalsOverride');
  if (total <= 1) return [];

  return [
    {
      severity: 'warning',
      message: `Multiple ShaderGlobalsOverride nodes detected in scene (${total} total). Godot activates only the first one to enter the tree (shader_globals_override.cpp:282); the rest override nothing.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'shaderglobalsoverride-multiple-in-scene',
    },
  ];
}

const shaderGlobalsOverrideValidationRule: LintRule = {
  meta: {
    name: 'valid-shaderglobalsoverride-properties',
    description: 'Warns when more than one ShaderGlobalsOverride node is in the scene',
    category: 'validation',
    applicableNodeTypes: ['ShaderGlobalsOverride'],
    emits: [{ ruleName: 'shaderglobalsoverride-multiple-in-scene', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkShaderGlobalsOverride,
};

ruleRegistry.register(shaderGlobalsOverrideValidationRule);

export { shaderGlobalsOverrideValidationRule };
