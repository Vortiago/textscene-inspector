/**
 * Semantic linter rule for PhysicalBone3D.
 *
 * `CollisionObject3D::get_configuration_warnings()` (collision_object_3d.cpp:739)
 *
 *     if (shapes.is_empty()) {
 *         warnings.push_back(RTR("This node has no shape, so it can't collide
 *             or interact with other objects. ..."));
 *     }
 *
 * reaches every CollisionObject3D descendant, but this repo implements that
 * ONE Godot condition as one rule per family (`area3d-needs-collision-shape`,
 * `staticbody3d-needs-collision-shape`, `characterbody3d-needs-collision-shape`,
 * `rigidbody3d-needs-collision-shape`) rather than a single base-walking rule —
 * and PhysicalBone3D, whose chain is PhysicsBody3D -> CollisionObject3D, sits
 * outside all four: it has no `linter.ts` of its own, and no family rule's
 * `applicableNodeTypeMatcher` reaches it. This file is that fifth family.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { JOINT_DATA, jointConstraintOwners, type JointType } from './jointConstraints.js';
import {
  hasCollisionShapeChild,
  collisionShapeTypesPhrase,
} from '../../../../linter/physics/hasCollisionShapeChild.js';

const RULE_NAME = 'physicalbone3d-needs-collision-shape';

/**
 * `joint_constraints/*` writes, judged against the JointData live when each
 * line is applied.
 *
 * `PhysicalBone3D::_set` (physical_bone_3d.cpp:715-724) forwards a key
 * `if (joint_data)` and otherwise returns false; `joint_data` is null until
 * `set_joint_type` builds the subclass for a type in 1..5 (:1094-1113 — NONE,
 * and any value outside the switch, leave it null). Each subclass's `_set`
 * compares the whole key against its own leaves and ends `else { return
 * false; }` (JOINT_DATA.refusedAt). Properties apply in file order, so a
 * `joint_type` below a constraint line does not help it. A leaf no subclass
 * declares is the phase-1 dispatcher's refusal and is skipped here.
 */
function jointConstraintDiagnostics(node: TscnNode, rawProps: Record<string, string>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const at = { nodeName: node.name, nodeType: node.type };
  // `undefined` once a `joint_type` no rule can read has applied: unknowable from there.
  let live: JointType | null | undefined = null;
  let seenJointType = false;
  for (const [key, raw] of Object.entries(rawProps)) {
    if (key === 'joint_type') {
      seenJointType = true;
      const type = ruleInt(raw);
      live = type === null ? undefined : type in JOINT_DATA ? (type as JointType) : null;
      continue;
    }
    if (live === undefined || !key.startsWith('joint_constraints/')) continue;
    const owners = jointConstraintOwners(key);
    if (owners === null) continue;
    if (live === null) {
      const below = !seenJointType && rawProps.joint_type !== undefined;
      diagnostics.push({
        ...at,
        severity: 'error',
        ruleName: 'physicalbone3d-joint-constraint-without-joint',
        message:
          `'${key}' is written while joint_type is NONE, so no JointData receives it and the write is dropped (physical_bone_3d.cpp:715).` +
          (below ? ` Godot applies properties in file order; move 'joint_type' above it.` : ''),
      });
    } else if (!owners.has(live)) {
      const data = JOINT_DATA[live];
      diagnostics.push({
        ...at,
        severity: 'error',
        ruleName: 'physicalbone3d-joint-constraint-wrong-joint-type',
        message: `'${key}' is not a ${data.name} property (joint_type = ${live}); its _set has no arm for it and returns false (${data.refusedAt}), so the write is dropped.`,
      });
    }
  }
  return diagnostics;
}

function checkPhysicalBone3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const diagnostics = jointConstraintDiagnostics(node, node.properties as unknown as Record<string, string>);
  if (hasCollisionShapeChild(node, '3D')) return diagnostics;

  diagnostics.push({
    severity: 'warning',
    message: `PhysicalBone3D '${node.name}' has no ${collisionShapeTypesPhrase('3D')} children. It has no shape, so it can't collide or interact with other objects.`,
    nodeName: node.name,
    nodeType: node.type,
    ruleName: RULE_NAME,
  });
  return diagnostics;
}

const physicalBone3DValidationRule: LintRule = {
  meta: {
    name: 'valid-physicalbone3d-collision-shape',
    description: 'Warns when a PhysicalBone3D has no CollisionShape3D or CollisionPolygon3D descendant, and errors on joint_constraints writes the live JointData drops',
    category: 'validation',
    applicableNodeTypes: ['PhysicalBone3D'],
    emits: [
      { ruleName: RULE_NAME, severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'physicalbone3d-joint-constraint-without-joint',
        severity: 'error',
        grounding: { kind: 'engine', at: 'physical_bone_3d.cpp:715' },
      },
      {
        ruleName: 'physicalbone3d-joint-constraint-wrong-joint-type',
        severity: 'error',
        grounding: { kind: 'engine', at: 'physical_bone_3d.cpp:724' },
      },
    ],
  },
  check: checkPhysicalBone3D,
};

ruleRegistry.register(physicalBone3DValidationRule);

export { physicalBone3DValidationRule };
