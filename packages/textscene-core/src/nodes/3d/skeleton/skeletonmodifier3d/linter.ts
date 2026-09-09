/**
 * Semantic linter rule for SkeletonModifier3D, from Godot's own configuration
 * warning, `SkeletonModifier3D::get_configuration_warnings()`
 * (skeleton_modifier_3d.cpp:32-38):
 *
 *     PackedStringArray warnings = Node3D::get_configuration_warnings();
 *     if (skeleton_id.is_null()) {
 *         warnings.push_back(RTR("Skeleton3D node not set! SkeletonModifier3D
 *             must be child of Skeleton3D."));
 *     }
 *     return warnings;
 *
 * `skeleton_id` is set ONLY from the DIRECT parent
 * (`_update_skeleton_path`, :47-55: `Object::cast_to<Skeleton3D>(get_parent())`),
 * never an ancestor further up — a grandparent Skeleton3D leaves it null, the
 * same as no parent at all.
 *
 * The largest reach in this batch: every concrete SkeletonModifier3D descendant
 * this repo registers inherits the check unchanged (none override
 * `get_configuration_warnings` without calling the base — verified against
 * every `.cpp` in the chain), which is 19 leaves plus SkeletonModifier3D itself.
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
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'SkeletonModifier3D'),
    emits: [{ ruleName: RULE_NAME, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkSkeletonModifier3D,
};

ruleRegistry.register(skeletonModifier3DParentRule);

export { skeletonModifier3DParentRule };
