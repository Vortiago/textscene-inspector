/**
 * Semantic linter rule for LookAtModifier3D, its one cross-field condition.
 *
 * `LookAtModifier3D::get_configuration_warnings()` (look_at_modifier_3d.cpp:70-76)
 * emits "Forward axis and primary rotation axis must not be parallel." when
 * `get_axis_from_bone_axis(forward_axis) == primary_rotation_axis`
 * (look_at_modifier_3d.cpp:72). Godot raises it itself, as a warning, so the
 * tier is settled: neither setter refuses the value, and the two properties are
 * only wrong together.
 *
 * It bites at runtime. `look_at_with_axes` projects the bone's forward vector
 * onto the plane of `primary_rotation_axis` (look_at_modifier_3d.cpp:719-721),
 * and `get_projection_vector` (:654-669) builds that 2D vector from the two
 * components the axis does NOT own. When the forward axis IS the rotation axis
 * both components are zero, so the projection is the zero vector, the angle it
 * measures is always 0, and the modifier never rotates about that axis.
 *
 * Not checkable per property, which is why it is a rule rather than a
 * validator: `forward_axis` and `primary_rotation_axis` are two keys, and each
 * is individually legal.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { BONE_AXIS, axisFromBoneAxis } from '../skeletonmodifier3d/linterParser.js';
import { VECTOR3_AXIS } from '../../../../linter/validators/sharedEnumLabels.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';

// look_at_modifier_3d.h:52-53, the field initialisers: a key a scene omits
// carries these, and the pair is not parallel (BONE_AXIS_PLUS_Z maps to AXIS_Z,
// the default primary axis is AXIS_Y), so two absent keys never trip this rule.
const DEFAULT_FORWARD_AXIS = 4; // BONE_AXIS_PLUS_Z
const DEFAULT_PRIMARY_ROTATION_AXIS = 1; // Vector3::AXIS_Y

/** A property's value, or the engine default when the scene omits it. */
function axisNumber(
  properties: Record<string, string>,
  key: string,
  fallback: number
): number {
  const raw = properties[key];
  if (raw === undefined) return fallback;
  const parsed = ruleInt(raw);
  // A malformed value is the validator's to report; NaN here would compare
  // false against everything and quietly suppress the rule instead.
  return parsed ?? fallback;
}

function checkLookAtModifier3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const properties = node.properties;

  const forwardAxis = axisNumber(properties, 'forward_axis', DEFAULT_FORWARD_AXIS);
  const primaryAxis = axisNumber(
    properties,
    'primary_rotation_axis',
    DEFAULT_PRIMARY_ROTATION_AXIS
  );
  if (axisFromBoneAxis(forwardAxis) !== primaryAxis) return [];

  const forwardLabel = BONE_AXIS[forwardAxis] ?? String(forwardAxis);
  const primaryLabel = VECTOR3_AXIS[primaryAxis] ?? String(primaryAxis);
  return [
    {
      severity: 'warning',
      message: `LookAtModifier3D '${node.name}' looks along ${forwardLabel} and rotates primarily about ${primaryLabel}, the same axis. Godot reports "Forward axis and primary rotation axis must not be parallel", and the projection it aims with is degenerate, so the primary rotation is always zero. Choose a primary_rotation_axis perpendicular to forward_axis.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'lookatmodifier3d-parallel-rotation-axes',
    },
  ];
}

const lookAtModifier3DAxisRule: LintRule = {
  meta: {
    name: 'valid-lookatmodifier3d-rotation-axes',
    description:
      "Warns when the forward axis is parallel to the primary rotation axis, the configuration Godot's own LookAtModifier3D warning refuses",
    category: 'validation',
    applicableNodeTypes: ['LookAtModifier3D'],
    emits: [{ ruleName: 'lookatmodifier3d-parallel-rotation-axes', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkLookAtModifier3D,
};

ruleRegistry.register(lookAtModifier3DAxisRule);

export { lookAtModifier3DAxisRule };
