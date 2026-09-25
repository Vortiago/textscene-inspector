/**
 * Semantic linter rules for PhysicalBone2D: the three tree checks of
 * `PhysicalBone2D::get_configuration_warnings` (scene/2d/physics/physical_bone_2d.cpp:109-126).
 * Each is a configuration warning, so each warns here. linterParser.ts does the format checks.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import type { TscnNode, TscnScene } from '../../../../parser/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { isTypeUnknowable, parentTypeVerdict, searchAncestors } from '../../../../linter/parentType.js';
import { descendsFrom, isCatalogedType } from '../../../../godot/nodeBaseTypes.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';

/** What `_find_skeleton_parent()` would settle on, read off this file alone. */
type SkeletonAncestry = 'found' | 'absent' | 'unknowable';

/**
 * physical_bone_2d.cpp:79-95 `_find_skeleton_parent()`: walks up a chain of PhysicalBone2D
 * ancestors to a Skeleton2D. Any other type stops the walk. The casts are `cast_to`, so
 * subclasses count (`descendsFrom`).
 */
function skeletonAncestry(scene: TscnScene, node: TscnNode): SkeletonAncestry {
  const search = searchAncestors<'found' | 'absent'>(scene, node, (ancestor) => {
    if (descendsFrom(ancestor.type, 'Skeleton2D')) return 'found';
    if (!descendsFrom(ancestor.type, 'PhysicalBone2D')) return 'absent';
    return undefined;
  });
  // `unknowable` is not `absent`: an ancestor whose class its instanced scene declares could be
  // the Skeleton2D, the next bone or the terminator, and ruling all three out warns on every
  // rig built that way.
  if (search.kind === 'unknowable') return 'unknowable';
  return search.kind === 'found' ? search.value : 'absent';
}

/**
 * The "Joint2D-based child" physical_bone_2d.cpp:118-122 asks for. Godot's test is a
 * `cast_to<Joint2D>`, so any subclass counts, through the reflexive `descendsFrom`, not a
 * hand-listed roster. A child of a class this build does not know may be one, so it is unseeable.
 */
function jointChildVerdict(children: readonly TscnNode[]): 'present' | 'absent' | 'unknowable' {
  if (children.some((child) => descendsFrom(child.type, 'Joint2D'))) return 'present';
  if (children.some((child) => isTypeUnknowable(child) || !isCatalogedType(child.type))) {
    return 'unknowable';
  }
  return 'absent';
}

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
    // Absent, or present but unreadable, both mean no index is assigned.
    const boneIndex = ruleInt(rawProps.bone2d_index ?? '') ?? -1;
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
    if (jointChildVerdict(node.children) === 'absent') {
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
