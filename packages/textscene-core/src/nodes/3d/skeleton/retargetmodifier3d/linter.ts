/**
 * Semantic linter rule for RetargetModifier3D: Godot's own configuration warning "There is no child
 * Skeleton3D!" (retarget_modifier_3d.cpp:33-39) when `child_skeletons` is empty. No key on the node
 * decides this tree shape, so it is a rule, not a validator. Godot warns itself: the scene loads
 * and the node is inert.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { hasChildOfType } from '../../../../linter/childType.js';
import { armDiagnostic, armEmits, type RuleArms } from '../../../../linter/ruleArms.js';

const arms = {
  noChildSkeleton: {
    severity: 'warning',
    ruleName: 'retargetmodifier3d-no-child-skeleton',
    grounding: { kind: 'configuration-warning' },
  },
} as const satisfies RuleArms<string>;

function checkRetargetModifier3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const children = node.children;

  // `_update_child_skeletons` (retarget_modifier_3d.cpp:175-191) keeps only the direct children
  // `Object::cast_to<Skeleton3D>` accepts (:180), so a deeper skeleton is never collected. A child
  // whose class lives elsewhere may be one, so it silences the rule.
  if (hasChildOfType(node, ['Skeleton3D'])) return [];

  const what =
    children.length === 0
      ? 'has no children'
      : `has only ${children.map((child) => child.type).join(', ')} as children`;

  return [
    armDiagnostic(
      arms.noChildSkeleton,
      node,
      `RetargetModifier3D '${node.name}' ${what}. It retargets the parent skeleton's pose onto Skeleton3D nodes placed directly beneath it, so with none there it collects no target and modifies nothing.`
    ),
  ];
}

const retargetModifier3DChildSkeletonRule: LintRule = {
  meta: {
    name: 'valid-retargetmodifier3d-child-skeleton',
    description:
      'Warns when a RetargetModifier3D has no direct child Skeleton3D to retarget onto, the state Godot itself reports as "There is no child Skeleton3D!"',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'RetargetModifier3D'),
    emits: armEmits(arms),
  },
  check: checkRetargetModifier3D,
};

ruleRegistry.register(retargetModifier3DChildSkeletonRule);

export { retargetModifier3DChildSkeletonRule };
