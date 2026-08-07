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
 * That is checkable from a `.tscn` alone for the SAME reason Camera2D's
 * multiple-enabled rule is (camera2d/linter.ts): whether a conflict exists at
 * all is a SCENE-WIDE fact (does this file contain more than one node of the
 * type?), even though which one loses is a TREE-ORDER fact this linter does
 * not simulate (Godot's tree-enter order, not document order, decides it, and
 * an instanced sub-scene can contribute one this linter never opens). So this
 * reuses Camera2D's shape exactly: warn on every instance once the count is
 * more than one, rather than guessing which one "wins".
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnScene } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';

/** Count every ShaderGlobalsOverride node anywhere in the scene tree. */
function countShaderGlobalsOverrides(scene: TscnScene): number {
  let count = 0;

  function traverse(nodes: TscnScene['nodes']): void {
    for (const node of nodes) {
      if (node.type === 'ShaderGlobalsOverride') count++;
      if (node.children && node.children.length > 0) traverse(node.children);
    }
  }

  traverse(scene.nodes);
  return count;
}

function checkShaderGlobalsOverride(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const total = countShaderGlobalsOverrides(scene);
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
    emits: [{ ruleName: 'shaderglobalsoverride-multiple-in-scene', severity: 'warning' }],
  },
  check: checkShaderGlobalsOverride,
};

ruleRegistry.register(shaderGlobalsOverrideValidationRule);

export { shaderGlobalsOverrideValidationRule };
