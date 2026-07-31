/**
 * The joint dead-configuration rule, shared by every Joint2D and Joint3D
 * subclass.
 *
 * Godot states these itself. `Joint2D::_update_joint` walks a chain of cases
 * and stores the failure in `warning`, which `get_configuration_warnings`
 * surfaces (scene/2d/physics/joints/joint_2d.cpp:78-90, and the 3D twin at
 * :76-88). Two of its five cases are decidable from the scene text alone and
 * are the two implemented here:
 *
 *   "Joint is not connected to two PhysicsBody2Ds"  — a node path is missing
 *   "Node A and Node B must be different …"          — both name the same node
 *
 * The other three ("Node A must be a PhysicsBody2D", and its two variants) ask
 * what TYPE the path resolves to. That is a live-tree question: a NodePath can
 * cross into an instanced sub-scene whose contents this linter cannot see, so
 * answering it statically produces false positives on exactly the scenes people
 * write. They are deliberately not implemented rather than approximated.
 *
 * ONE rule rather than one per dimension or one per joint type. The dimension
 * changes a noun in the message and nothing else, and
 * `applicableNodeTypeMatcher` reaches every descendant the way
 * `valid-node3d-visibility` reaches every spatial node, so the eight leaf
 * slices declare nothing and a ninth joint is covered the day it is added.
 */

import type { Diagnostic, LintRule, RuleContext } from '../../../../linter/types.js';
import { NODE_BASE_TYPES } from '../../../../linter/nodeBaseTypes.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';

/** Does `nodeType` descend from (or equal) `ancestor`? */
function descendsFrom(nodeType: string, ancestor: string): boolean {
  const seen = new Set<string>();
  let current: string | undefined = nodeType;
  while (current && !seen.has(current)) {
    if (current === ancestor) return true;
    seen.add(current);
    current = NODE_BASE_TYPES[current];
  }
  return false;
}

/** `'2D'` or `'3D'` for a joint type, or undefined when it is not a joint. */
function jointDim(nodeType: string): '2D' | '3D' | undefined {
  if (descendsFrom(nodeType, 'Joint2D')) return '2D';
  if (descendsFrom(nodeType, 'Joint3D')) return '3D';
  return undefined;
}

/** `NodePath("../BodyA")` → `../BodyA`; anything else, including empty → undefined. */
function nodePathTarget(raw: string | undefined): string | undefined {
  const match = raw?.match(/^NodePath\("([^"]*)"\)$/);
  const path = match?.[1]?.trim();
  return path ? path : undefined;
}

function checkJoint(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const dim = jointDim(node.type);
  if (!dim) return [];

  const props = node.properties as Record<string, string>;
  const bodyType = `PhysicsBody${dim}`;
  const prefix = `joint${dim.toLowerCase()}`;

  const a = nodePathTarget(props.node_a);
  const b = nodePathTarget(props.node_b);

  // Exclusive, as in Godot's own chain: an unset end is reported once, and the
  // same-body case cannot arise while an end is unset.
  if (!a || !b) {
    const which = !a && !b ? "'node_a' and 'node_b' are" : `'${!a ? 'node_a' : 'node_b'}' is`;
    return [
      {
        severity: 'warning',
        message: `${node.type} '${node.name}' is not connected to two ${bodyType}s: ${which} unset, so the joint does nothing.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-not-connected`,
      },
    ];
  }

  if (a === b) {
    return [
      {
        severity: 'warning',
        message: `${node.type} '${node.name}' has 'node_a' and 'node_b' both pointing at ${a}. A joint must connect two different ${bodyType}s.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: `${prefix}-same-body`,
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
    emits: [
      { ruleName: 'joint2d-not-connected', severity: 'warning' },
      { ruleName: 'joint2d-same-body', severity: 'warning' },
      { ruleName: 'joint3d-not-connected', severity: 'warning' },
      { ruleName: 'joint3d-same-body', severity: 'warning' },
    ],
  },
  check: checkJoint,
};

ruleRegistry.register(jointValidationRule);

export { jointValidationRule };
