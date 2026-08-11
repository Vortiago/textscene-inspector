/**
 * The joint dead-configuration rule, shared by every Joint2D and Joint3D
 * subclass.
 *
 * Godot states these itself. `Joint2D::_update_joint` walks a chain of cases
 * and stores the failure in `warning`, which `get_configuration_warnings`
 * surfaces (scene/2d/physics/joints/joint_2d.cpp:78-91, and the 3D twin at
 * joint_3d.cpp:76-88). Two of its five cases are decidable from the scene text
 * alone and are the two implemented here:
 *
 *   "Joint is not connected to …"            — a node path is missing
 *   "Node A and Node B must be different …"  — both name the same node
 *
 * The other three ("Node A must be a PhysicsBody2D", and its two variants) ask
 * what TYPE the path resolves to. That is a live-tree question: a NodePath can
 * cross into an instanced sub-scene whose contents this linter cannot see, so
 * answering it statically produces false positives on exactly the scenes people
 * write. They are deliberately not implemented rather than approximated.
 *
 * **The two dimensions disagree on the first case, and the difference is not a
 * typo to normalise away.** 2D warns on `!body_a || !body_b` — "not connected to
 * TWO PhysicsBody2Ds" (joint_2d.cpp:84-85) — so one loose end is enough. 3D
 * warns on `!body_a && !body_b` — "not connected to ANY PhysicsBody3Ds"
 * (joint_3d.cpp:82-83) — so a 3D joint anchored to the world by one body is a
 * configuration Godot accepts in silence. Reading the two as one rule is what
 * produced a warning on scenes 4.6.3 says nothing about.
 *
 * ONE rule rather than one per dimension or one per joint type. The dimension
 * changes a noun in the message and nothing else, and
 * `applicableNodeTypeMatcher` reaches every descendant the way
 * `valid-node3d-visibility` reaches every spatial node, so the eight leaf
 * slices declare nothing and a ninth joint is covered the day it is added.
 */

import type { Diagnostic, LintRule, RuleContext } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { extractNodePath } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { resolveNodePath } from '../../../../linter/nodePathResolve.js';

/** `'2D'` or `'3D'` for a joint type, or undefined when it is not a joint. */
function jointDim(nodeType: string): '2D' | '3D' | undefined {
  if (descendsFrom(nodeType, 'Joint2D')) return '2D';
  if (descendsFrom(nodeType, 'Joint3D')) return '3D';
  return undefined;
}

function checkJoint(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const dim = jointDim(node.type);
  if (!dim) return [];

  const props = node.properties as Record<string, string>;
  const bodyType = `PhysicsBody${dim}`;

  // `extractNodePath` already treats an empty NodePath as absent, which is how
  // Godot serialises "not connected".
  //
  // But a path being WRITTEN is not the same as a body being found. `_update_joint`
  // derives `body_a` from `cast_to<PhysicsBody2D>(get_node_or_null(a))`
  // (joint_2d.cpp:70-74, joint_3d.cpp:70-74), and the "not connected" arm tests
  // `!body_a` — so a path naming nothing counts as unset. Only `missing` does:
  // `unknowable` means the target may live in a sub-scene this file cannot open,
  // and a wrong-type target is Godot's own "must be a PhysicsBody" string, an
  // unimplemented census row rather than this rule's business.
  //
  // The resolved node is kept, not just the path: `_update_joint`'s same-body arm
  // compares POINTERS (`body_a == body_b`, joint_2d.cpp:86), so `../Body` and
  // `%Body` naming one node are the same body however differently they are
  // spelled. Two identical strings always walk to the same place, which is what
  // keeps the answer available when the target is `unknowable`.
  const connected = (raw: string | undefined): { path: string; node?: TscnNode } | null => {
    const path = raw ? extractNodePath(raw) : null;
    if (path === null) return null;
    const target = resolveNodePath(context.scene, node, path);
    if (target.status === 'missing') return null;
    return target.status === 'found' ? { path, node: target.node } : { path };
  };
  const a = connected(props.node_a);
  const b = connected(props.node_b);
  const sameBody = Boolean(a && b && (a.path === b.path || (a.node !== undefined && a.node === b.node)));

  // Exclusive, as in Godot's own chain: an unset end is reported once, and the
  // same-body case cannot arise while an end is unset. How many ends have to be
  // unset differs by dimension — see the docblock.
  const unconnected = dim === '2D' ? !a || !b : !a && !b;
  if (unconnected) {
    const which = !a && !b ? "'node_a' and 'node_b' are" : `'${!a ? 'node_a' : 'node_b'}' is`;
    const howMany = dim === '2D' ? 'two' : 'any';
    return [
      {
        severity: 'warning',
        message: `${node.type} '${node.name}' is not connected to ${howMany} ${bodyType}s: ${which} unset, so the joint does nothing.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'joint-not-connected',
      },
    ];
  }

  if (sameBody) {
    return [
      {
        severity: 'warning',
        message: `${node.type} '${node.name}' has 'node_a' and 'node_b' both pointing at ${a!.node?.name ?? a!.path}. A joint must connect two different ${bodyType}s.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'joint-same-body',
      },
    ];
  }

  return [];
}

const jointValidationRule: LintRule = {
  meta: {
    name: 'valid-joint',
    description: 'Flags a joint that cannot form a constraint',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => jointDim(nodeType) !== undefined,
    // Dimension-free: `emits` is rule-level, so a per-dimension name would put
    // `joint3d-not-connected` in every PinJoint2D sheet. The dimension is
    // already on the diagnostic's `nodeType` and in its message.
    emits: [
      { ruleName: 'joint-not-connected', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'joint-same-body', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkJoint,
};

ruleRegistry.register(jointValidationRule);

export { jointValidationRule };
