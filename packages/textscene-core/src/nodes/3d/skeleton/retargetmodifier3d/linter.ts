/**
 * Semantic linter rule for RetargetModifier3D: Godot's own configuration warning "There is no child
 * Skeleton3D!" (retarget_modifier_3d.cpp:33-39) when `child_skeletons` is empty. No key on the node
 * decides this tree shape, so it is a rule, not a validator. Godot warns itself: the scene loads
 * and the node is inert.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { isTypeUnknowable } from '../../../../linter/parentType.js';

const RULE_NAME = 'retargetmodifier3d-no-child-skeleton';


function checkRetargetModifier3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const children = node.children;

  // A child whose type this file does not state (an instance, an index= override, or a heading with
  // no identifier) could be the Skeleton3D. The linter does not open another file, so the rule
  // stays quiet.
  if (children.some(isTypeUnknowable)) return [];
  // `_update_child_skeletons` (retarget_modifier_3d.cpp:175-191) keeps only the direct children
  // `Object::cast_to<Skeleton3D>` accepts (:180), so a deeper skeleton is never collected and
  // `_process_modification` retargets nothing.
  if (children.some((child) => descendsFrom(child.type, 'Skeleton3D'))) return [];

  const what =
    children.length === 0
      ? 'has no children'
      : `has only ${children.map((child) => child.type).join(', ')} as children`;

  return [
    {
      severity: 'warning',
      message: `RetargetModifier3D '${node.name}' ${what}. It retargets the parent skeleton's pose onto Skeleton3D nodes placed directly beneath it, so with none there it collects no target and modifies nothing.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: RULE_NAME,
    },
  ];
}

const retargetModifier3DChildSkeletonRule: LintRule = {
  meta: {
    name: 'valid-retargetmodifier3d-child-skeleton',
    description:
      'Warns when a RetargetModifier3D has no direct child Skeleton3D to retarget onto, the state Godot itself reports as "There is no child Skeleton3D!"',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'RetargetModifier3D'),
    emits: [{ ruleName: RULE_NAME, severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkRetargetModifier3D,
};

ruleRegistry.register(retargetModifier3DChildSkeletonRule);

export { retargetModifier3DChildSkeletonRule };
