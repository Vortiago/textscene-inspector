/**
 * Semantic linter rule for RetargetModifier3D - Godot's own configuration
 * warning, `RetargetModifier3D::get_configuration_warnings()`
 * (retarget_modifier_3d.cpp:33-39):
 *
 *     if (child_skeletons.is_empty()) {
 *         warnings.push_back(RTR("There is no child Skeleton3D!"));
 *     }
 *
 * `child_skeletons` is filled by `_update_child_skeletons`
 * (retarget_modifier_3d.cpp:175-191), which walks `get_child(i)` and keeps only
 * what `Object::cast_to<Skeleton3D>` accepts (:180). Two consequences the rule
 * has to honour: the walk is over DIRECT children alone, so a skeleton one level
 * deeper is never collected, and with the vector empty `_process_modification`
 * has nothing to write to, so the modifier retargets nothing at all.
 *
 * The tier is settled by Godot raising it as a warning itself: no setter refuses
 * anything, the scene loads, and the node is simply inert.
 *
 * This is a tree-shape claim rather than a property one, which is why it is a
 * rule and not a validator: no key on the node can be read to decide it.
 *
 * A child heading carrying `instance=` takes its type from another file, which
 * the linter does not open, so such a child could be the Skeleton3D and the rule
 * stays quiet rather than guessing.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { isTypeUnknowable } from '../../../../linter/parentType.js';

const RULE_NAME = 'retargetmodifier3d-no-child-skeleton';


function checkRetargetModifier3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const children = node.children;

  // A child whose type this file does not state: an instance, an index=
  // override, or a heading with no identifier at all.
  if (children.some(isTypeUnknowable)) return [];
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
