/**
 * The joint dead-configuration rule: one rule for every Joint2D and Joint3D subclass.
 * It ports the `_update_joint` cases the scene text decides (joint_3d.cpp:76-88,
 * scene/2d/physics/joints/joint_2d.cpp:78-91). The "must be a PhysicsBody" cases
 * need the target's type, which an instanced sub-scene hides, so they are not ported.
 */

import type { Diagnostic, LintRule, RuleContext } from '../../../../linter/types.js';
import type { TscnNode } from '../../../../parser/types.js';
import { extractNodePath } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
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

  // An empty NodePath, Godot's "not connected", is absent. `body_a` is
  // `cast_to<PhysicsBody2D>(get_node_or_null(a))` (joint_2d.cpp:70-74, joint_3d.cpp:70-74),
  // so a `missing` target is unset too. An `unknowable` one may live in a sub-scene.
  // The resolved node is kept because the same-body arm compares pointers.
  const connected = (raw: string | undefined): { path: string; node?: TscnNode } | null => {
    const path = raw ? extractNodePath(raw) : null;
    if (path === null) return null;
    const target = resolveNodePath(context.scene, node, path);
    if (target.status === 'missing') return null;
    return target.status === 'found' ? { path, node: target.node } : { path };
  };
  const a = connected(props.node_a);
  const b = connected(props.node_b);
  // `body_a == body_b` (joint_2d.cpp:86) compares pointers, so `../Body` and `%Body`
  // naming one node are one body. Identical strings match even when `unknowable`.
  const sameBody = Boolean(a && b && (a.path === b.path || (a.node !== undefined && a.node === b.node)));

  // Exclusive, as in Godot's own chain: an unset end is reported once, and the
  // same-body case cannot arise while an end is unset. 2D warns on one unset end
  // (joint_2d.cpp:84-85). 3D warns only when both are unset (joint_3d.cpp:82-83).
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
