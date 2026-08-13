/**
 * Semantic linter rules for PhysicalBone2D.
 *
 * Format validation is in linterParser.ts. This file covers the three
 * scene-context checks `PhysicalBone2D::get_configuration_warnings` performs
 * (scene/2d/physics/physical_bone_2d.cpp:109-126), which need the surrounding
 * tree rather than the node's own properties:
 *   1. the node needs a Skeleton2D ancestor, reached through zero or more
 *      PhysicalBone2D parents (`_find_skeleton_parent`, cpp:79-95);
 *   2. once that ancestor exists, `bone2d_index` must actually name a bone;
 *   3. a PhysicalBone2D chained under another PhysicalBone2D should carry a
 *      Joint2D-derived child to keep the two bones connected.
 *
 * All three are advisory in Godot's own configuration-warnings panel, so they
 * are `warning` severity here too.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import type { TscnNode, TscnScene } from '../../../../parser/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { parentTypeVerdict, searchAncestors } from '../../../../linter/parentType.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';

/** What `_find_skeleton_parent()` would settle on, read off this file alone. */
type SkeletonAncestry = 'found' | 'absent' | 'unknowable';

/**
 * physical_bone_2d.cpp:79-95 `_find_skeleton_parent()` — walks up through a
 * chain of PhysicalBone2D ancestors until it reaches a Skeleton2D. Any other
 * type stops the walk immediately (the engine's `current_parent` goes null),
 * so a PhysicalBone2D under, say, a plain Node2D never finds one either.
 *
 * `unknowable` is a third answer rather than a second way of saying `absent`:
 * an ancestor whose class is declared in the scene it was instanced from could
 * be the Skeleton2D, the next bone in the chain, or the type that ends the
 * walk, and calling it none of the three warns on every rig built that way.
 * The engine's casts are `cast_to`, so subclasses count, hence `descendsFrom`.
 */
function skeletonAncestry(scene: TscnScene, node: TscnNode): SkeletonAncestry {
  const search = searchAncestors<'found' | 'absent'>(scene, node, (ancestor) => {
    if (descendsFrom(ancestor.type, 'Skeleton2D')) return 'found';
    if (!descendsFrom(ancestor.type, 'PhysicalBone2D')) return 'absent';
    return undefined;
  });
  if (search.kind === 'unknowable') return 'unknowable';
  return search.kind === 'found' ? search.value : 'absent';
}

/**
 * Joint2D and its only three subclasses (doc/classes/*.xml: DampedSpringJoint2D,
 * GrooveJoint2D, PinJoint2D each `inherits="Joint2D"`) — the "Joint2D-based
 * child" physical_bone_2d.cpp:118-122 asks for.
 */
const JOINT2D_TYPES = new Set(['Joint2D', 'PinJoint2D', 'GrooveJoint2D', 'DampedSpringJoint2D']);

function checkPhysicalBone2D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;
  if (!isValidProperties(node.properties)) return diagnostics;

  const rawProps = node.properties as Record<string, string>;
  const ancestry = skeletonAncestry(scene, node);

  // `unknowable` answers neither warning: the first needs to know the ancestor
  // is not a Skeleton2D, the second needs to know it is.
  if (ancestry === 'absent') {
    diagnostics.push({
      severity: 'warning',
      message: `PhysicalBone2D '${node.name}' has no Skeleton2D ancestor. A PhysicalBone2D only works with a Skeleton2D or another PhysicalBone2D as a parent node.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'physicalbone2d-missing-skeleton-parent',
    });
  } else if (ancestry === 'found') {
    const boneIndex = rawProps.bone2d_index !== undefined ? parseFloat(rawProps.bone2d_index) : -1;
    if (!(boneIndex > -1)) {
      diagnostics.push({
        severity: 'warning',
        message: `PhysicalBone2D '${node.name}' has no bone2d_index assigned. A PhysicalBone2D needs to be assigned to a Bone2D node (set bone2d_index) in order to function.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'physicalbone2d-missing-bone-index',
      });
    }
  }

  // `cast_to<PhysicalBone2D>(get_parent())` (physical_bone_2d.cpp:119), so
  // subclasses count and an unseeable parent decides nothing.
  if (parentTypeVerdict(scene, node, 'PhysicalBone2D').kind === 'satisfied') {
    const hasJointChild = node.children.some((child) => JOINT2D_TYPES.has(child.type));
    if (!hasJointChild) {
      diagnostics.push({
        severity: 'warning',
        message: `PhysicalBone2D '${node.name}' is chained under another PhysicalBone2D but has no Joint2D-based child. A PhysicalBone2D node should have a Joint2D-based child node to keep bones connected.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'physicalbone2d-missing-joint-child',
      });
    }
  }

  return diagnostics;
}

const physicalBone2DValidationRule: LintRule = {
  meta: {
    name: 'valid-physicalbone2d',
    description:
      'Validates PhysicalBone2D scene-context rules mirrored from get_configuration_warnings: Skeleton2D/PhysicalBone2D ancestry, an assigned bone2d_index, and a Joint2D child when chained under another PhysicalBone2D',
    category: 'validation',
    applicableNodeTypes: ['PhysicalBone2D'],
    emits: [
      { ruleName: 'physicalbone2d-missing-skeleton-parent', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'physicalbone2d-missing-bone-index', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'physicalbone2d-missing-joint-child', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkPhysicalBone2D,
};

ruleRegistry.register(physicalBone2DValidationRule);

export { physicalBone2DValidationRule };
