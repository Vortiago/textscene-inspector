/**
 * AimModifier3D's cross-field condition, from `get_configuration_warnings()` (aim_modifier_3d.cpp:99-108):
 * with `use_euler` on, a forward axis parallel to the primary rotation axis warns
 * (aim_modifier_3d.cpp:102). Neither setter refuses a value, and the three keys of one setting are
 * each legal alone, so it is a rule, not a validator.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { BONE_AXIS, axisFromBoneAxis } from '../skeletonmodifier3d/linterParser.js';
import { VECTOR3_AXIS } from '../../../../linter/validators/sharedEnumLabels.js';
import { ruleCount, ruleInt } from '../../../../linter/validators/commonValidators.js';
import { indexedElements, boolSlotValue} from '../../../../godot/index.js';

const SETTING_PREFIX = 'settings/';

// aim_modifier_3d.h:40-44, the AimModifier3DSetting field initialisers: a key a
// scene omits carries these, and neither pair of defaults is parallel
// (BONE_AXIS_PLUS_Y maps to AXIS_Y, the default primary axis is AXIS_X), so an
// absent key never trips this rule.
const DEFAULT_FORWARD_AXIS = 2; // BONE_AXIS_PLUS_Y
const DEFAULT_PRIMARY_ROTATION_AXIS = 0; // Vector3::AXIS_X

/**
 * Every setting the scene declares, keyed by the index `_set` resolves it to. `_set` reads the index
 * with a bare `path.get_slicec('/', 1).to_int()` and no validity gate (aim_modifier_3d.cpp:38), so
 * `settings/x/…` and `settings/00/…` land on setting 0. It refuses an index at or past
 * `settings.size()` (aim_modifier_3d.cpp:40), so a key beyond `setting_count` (default 0) never lands.
 */
function declaredSettings(properties: Record<string, string>): Map<number, Map<string, string>> {
  const settingCount = ruleCount(properties.setting_count) ?? 0;
  const settings = indexedElements(properties, SETTING_PREFIX, 'to_int');
  for (const index of [...settings.keys()]) {
    if (index >= settingCount) settings.delete(index);
  }
  return settings;
}

/** A setting's value for `leaf`, or the engine default when the scene omits it. */
function settingNumber(
  leaves: ReadonlyMap<string, string>,
  leaf: string,
  fallback: number
): number {
  const raw = leaves.get(leaf);
  if (raw === undefined) return fallback;
  const parsed = ruleInt(raw);
  // A malformed value is the validator's to report. NaN here would compare false against
  // everything and suppress the rule.
  return parsed ?? fallback;
}

function checkAimModifier3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const properties = node.properties;

  const diagnostics: Diagnostic[] = [];
  const settings = [...declaredSettings(properties)].sort(([a], [b]) => a - b);
  for (const [index, leaves] of settings) {
    if (boolSlotValue(leaves.get('use_euler')) !== true) continue;

    const forwardAxis = settingNumber(leaves, 'forward_axis', DEFAULT_FORWARD_AXIS);
    const primaryAxis = settingNumber(
      leaves,
      'primary_rotation_axis',
      DEFAULT_PRIMARY_ROTATION_AXIS
    );
    // `_process_aim` projects the target onto the plane of the primary axis
    // (aim_modifier_3d.cpp:235-238), and a parallel forward axis projects to a degenerate vector.
    if (axisFromBoneAxis(forwardAxis) !== primaryAxis) continue;

    const forwardLabel = BONE_AXIS[forwardAxis] ?? String(forwardAxis);
    const primaryLabel = VECTOR3_AXIS[primaryAxis] ?? String(primaryAxis);
    diagnostics.push({
      severity: 'warning',
      message: `AimModifier3D '${node.name}' setting ${index} aims along ${forwardLabel} and rotates primarily about ${primaryLabel}, the same axis. With use_euler enabled Godot reports "Forward axis and primary rotation axis must not be parallel in setting ${index}", and the projection it aims with is degenerate. Choose a primary_rotation_axis perpendicular to forward_axis.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'aimmodifier3d-parallel-rotation-axes',
    });
  }

  return diagnostics;
}

const aimModifier3DAxisRule: LintRule = {
  meta: {
    name: 'valid-aimmodifier3d-rotation-axes',
    description:
      "Warns when a euler setting's forward axis is parallel to its primary rotation axis, the configuration Godot's own AimModifier3D warning refuses",
    category: 'validation',
    applicableNodeTypes: ['AimModifier3D'],
    emits: [{ ruleName: 'aimmodifier3d-parallel-rotation-axes', severity: 'warning', grounding: { kind: 'configuration-warning' } }],
  },
  check: checkAimModifier3D,
};

ruleRegistry.register(aimModifier3DAxisRule);

export { aimModifier3DAxisRule };
