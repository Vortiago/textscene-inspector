/**
 * Semantic linter rule for ShaderGlobalsOverride.
 *
 * `ShaderGlobalsOverride::get_configuration_warnings()`
 * (shader_globals_override.cpp:278-286) pushes one warning, at :282, and gates it
 * on `if (!active)` (:281) — so Godot warns the LOSERS and never the winner.
 * `_activate()` (:228-250) sets `active = true` only `if (nodes.is_empty())`
 * (:231), i.e. for the first node to reach NOTIFICATION_ENTER_TREE; every later
 * one finds `shader_overrides_group_active` non-empty and stays inactive for the
 * rest of its life (removing the first only re-activates deferred, at :272).
 *
 * The winner is decidable from the file: `SceneTree` keeps a group in tree order
 * (`_update_group_order`, scene_tree.cpp:333-347, sorting by `Node::Comparator`),
 * which is what `firstNodeOfType` reproduces — the same reading the
 * WorldEnvironment twin uses. No `joins` predicate, unlike that twin: `_activate`
 * runs unconditionally on ENTER_TREE, so every ShaderGlobalsOverride enters the
 * race regardless of what it overrides.
 *
 * Limitation, shared with that twin: a ShaderGlobalsOverride behind `instance=`
 * can be the real first and is invisible here.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { countNodesOfType, firstNodeOfType } from '../../../linter/linterUtils.js';

function checkShaderGlobalsOverride(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const total = countNodesOfType(scene.nodes, 'ShaderGlobalsOverride');
  if (total <= 1) return [];
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
