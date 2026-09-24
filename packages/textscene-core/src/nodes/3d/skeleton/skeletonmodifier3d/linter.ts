/**
 * Semantic linter rule for SkeletonModifier3D: Godot's own configuration warning "Skeleton3D node
 * not set! SkeletonModifier3D must be child of Skeleton3D." (skeleton_modifier_3d.cpp:32-38) when
 * `skeleton_id` is null. `_update_skeleton_path` (:47-55) sets it only from
 * `Object::cast_to<Skeleton3D>(get_parent())`, so a grandparent Skeleton3D leaves it null.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { parentTypeVerdict, placementPhrase } from '../../../../linter/parentType.js';

const RULE_NAME = 'skeletonmodifier3d-parent-not-skeleton3d';

function checkSkeletonModifier3D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const verdict = parentTypeVerdict(scene, node, 'Skeleton3D');
  // `unknowable` (an instanced or untyped parent) may well BE a Skeleton3D
  // this linter cannot see into; `satisfied` is the direct-parent match.
  if (verdict.kind === 'satisfied' || verdict.kind === 'unknowable') return [];

  const where = placementPhrase(verdict);
  return [
    {
      severity: 'warning',
      message: `${node.type} '${node.name}' is ${where}. SkeletonModifier3D must be a direct child of Skeleton3D to resolve one; without it, this modifier does nothing.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: RULE_NAME,
    },
  ];
}

const skeletonModifier3DParentRule: LintRule = {
  meta: {
    name: 'valid-skeletonmodifier3d-parent',
    description:
      'Warns when a SkeletonModifier3D-family node has no direct Skeleton3D parent, so it resolves no skeleton and does nothing',
    category: 'validation',
    // Every descendant inherits the check unchanged: none overrides `get_configuration_warnings`
    // without calling the base.
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'SkeletonModifier3D'),
    emits: [{ ruleName: RULE_NAME, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkSkeletonModifier3D,
};

ruleRegistry.register(skeletonModifier3DParentRule);

export { skeletonModifier3DParentRule };
