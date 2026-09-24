/**
 * PhysicalBone3D's own rule: `joint_constraints/*` writes judged against the
 * JointData live when each line applies. The no-shape configuration warning
 * (collision_object_3d.cpp:739) reaches it through the CollisionObject3D rule.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { JOINT_DATA, jointConstraintOwners, type JointType } from './jointConstraints.js';

/**
 * `joint_constraints/*` writes, judged against the JointData live when each line applies.
 * `PhysicalBone3D::_set` (physical_bone_3d.cpp:715-724) forwards a key only `if (joint_data)`, which
 * `set_joint_type` builds for a type in 1..5 (:1094-1113), never for NONE or a value outside the switch.
 * Each subclass refuses a leaf not its own (JOINT_DATA.refusedAt). Properties apply in file order.
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
    // A leaf no subclass declares is the phase-1 dispatcher's refusal.
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
  return jointConstraintDiagnostics(node, node.properties as unknown as Record<string, string>);
}

const physicalBone3DValidationRule: LintRule = {
  meta: {
    name: 'valid-physicalbone3d-collision-shape',
    description: 'Warns when a PhysicalBone3D has no CollisionShape3D or CollisionPolygon3D descendant, and errors on joint_constraints writes the live JointData drops',
    category: 'validation',
    applicableNodeTypes: ['PhysicalBone3D'],
    emits: [
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
