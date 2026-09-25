/**
 * ShaderGlobalsOverride's rule: `get_configuration_warnings()`
 * (shader_globals_override.cpp:278-286) warns at :282 only `if (!active)` (:281), and
 * `_activate()` (:228-250) activates only the first node to enter the tree (:231).
 * Removing the first re-activates another only deferred (:272).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { countNodesOfType, firstNodeOfType } from '../../../linter/linterUtils.js';

function checkShaderGlobalsOverride(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const total = countNodesOfType(scene.nodes, 'ShaderGlobalsOverride');
  if (total <= 1) return [];
  // A group keeps tree order (scene_tree.cpp:333-347, `Node::Comparator`), which
  // `firstNodeOfType` reproduces. `_activate` runs on every ENTER_TREE, so no `joins`
  // predicate filters the race. An override behind `instance=` can be the real
  // first and is invisible here.
  if (node === firstNodeOfType(scene.nodes, 'ShaderGlobalsOverride')) return [];

  return [
    {
      severity: 'warning',
      message: `ShaderGlobalsOverride '${node.name}' is not the first in the scene, so Godot leaves it inactive and it overrides nothing (shader_globals_override.cpp:282). ${total} are declared here; only the first to enter the tree activates.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'shaderglobalsoverride-multiple-in-scene',
    },
  ];
}

const shaderGlobalsOverrideValidationRule: LintRule = {
  meta: {
    name: 'valid-shaderglobalsoverride-properties',
    description:
      'Warns on every ShaderGlobalsOverride but the first in the scene, which are the ones Godot leaves inactive',
    category: 'validation',
    applicableNodeTypes: ['ShaderGlobalsOverride'],
    emits: [{ ruleName: 'shaderglobalsoverride-multiple-in-scene', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkShaderGlobalsOverride,
};

ruleRegistry.register(shaderGlobalsOverrideValidationRule);

export { shaderGlobalsOverrideValidationRule };
