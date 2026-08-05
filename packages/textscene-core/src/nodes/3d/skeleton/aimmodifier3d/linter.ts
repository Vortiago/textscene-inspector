/**
 * Semantic linter rule for AimModifier3D, its one cross-field condition.
 *
 * `AimModifier3D::get_configuration_warnings()` (aim_modifier_3d.cpp:99-108)
 * walks every setting and emits "Forward axis and primary rotation axis must
 * not be parallel in setting %s." when
 * `is_using_euler(i) && get_axis_from_bone_axis(get_forward_axis(i)) ==
 * get_primary_rotation_axis(i)` (aim_modifier_3d.cpp:102). Godot raises it
 * itself, as a warning, so the tier is settled: neither setter refuses the
 * value, and the two properties are only wrong together.
 *
 * It bites at runtime. With `use_euler` on, `_process_aim` projects the target
 * onto the plane of `primary_rotation_axis` (aim_modifier_3d.cpp:235-238); a
 * forward axis parallel to that rotation axis projects to a degenerate vector,
 * so the rotation it computes is meaningless.
 *
 * No condition here is checkable per property, which is why it is a rule rather
 * than a validator: `use_euler`, `forward_axis` and `primary_rotation_axis` are
 * three separate keys of one setting, and each is individually legal.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';

const SETTING_PREFIX = 'settings/';
const SETTING_INDEX_RE = /^\d+$/;

// aim_modifier_3d.h:40-44, the AimModifier3DSetting field initialisers: a key a
// scene omits carries these, and neither pair of defaults is parallel
// (BONE_AXIS_PLUS_Y maps to AXIS_Y, the default primary axis is AXIS_X), so an
// absent key never trips this rule.
const DEFAULT_FORWARD_AXIS = 2; // BONE_AXIS_PLUS_Y
const DEFAULT_PRIMARY_ROTATION_AXIS = 0; // Vector3::AXIS_X

/** BoneAxis labels for the diagnostic (skeleton_modifier_3d.h:45-50). */
const BONE_AXIS_LABELS = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];
/** Vector3::Axis labels (vector3.h:57-61). */
const VECTOR3_AXIS_LABELS = ['X', 'Y', 'Z'];

/**
 * `SkeletonModifier3D::get_axis_from_bone_axis` (skeleton_modifier_3d.cpp:244-260).
 * The switch has NO default case and seeds `ret` with `AXIS_X`, so a value
 * outside 0-5 resolves to X rather than to nothing, and Godot compares that X
 * against the primary axis exactly as it would a legal one.
 */
function axisFromBoneAxis(boneAxis: number): number {
  if (boneAxis < 0 || boneAxis > 5) return 0;
  return Math.floor(boneAxis / 2);
}

/**
 * Settings the scene actually declares, in ascending order.
 *
 * Bounded by `setting_count`, which defaults to 0: `_set` refuses an index at
 * or past `settings.size()` (aim_modifier_3d.cpp:40), so keys beyond the count
 * never land and the condition cannot arise for them.
 */
function declaredSettingIndices(properties: Record<string, string>): number[] {
  const declaredCount = Number(properties.setting_count ?? '0');
  const settingCount = Number.isFinite(declaredCount) ? Math.trunc(declaredCount) : 0;

  const indices = new Set<number>();
  for (const key of Object.keys(properties)) {
    if (!key.startsWith(SETTING_PREFIX)) continue;
    const slash = key.indexOf('/', SETTING_PREFIX.length);
    if (slash < 0) continue;
    const indexText = key.slice(SETTING_PREFIX.length, slash);
    if (!SETTING_INDEX_RE.test(indexText)) continue;
    const index = Number(indexText);
    if (index < settingCount) indices.add(index);
  }
  return [...indices].sort((a, b) => a - b);
}

/** A setting's value for `leaf`, or the engine default when the scene omits it. */
function settingNumber(
  properties: Record<string, string>,
  index: number,
  leaf: string,
  fallback: number
): number {
  const raw = properties[`${SETTING_PREFIX}${index}/${leaf}`];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  // A malformed value is the validator's to report; NaN here would compare
  // false against everything and quietly suppress the rule instead.
  return Number.isFinite(parsed) ? parsed : fallback;
}

function checkAimModifier3D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const properties = node.properties;

  const diagnostics: Diagnostic[] = [];
  for (const index of declaredSettingIndices(properties)) {
    if (properties[`${SETTING_PREFIX}${index}/use_euler`]?.trim() !== 'true') continue;

    const forwardAxis = settingNumber(properties, index, 'forward_axis', DEFAULT_FORWARD_AXIS);
    const primaryAxis = settingNumber(
      properties,
      index,
      'primary_rotation_axis',
      DEFAULT_PRIMARY_ROTATION_AXIS
    );
    if (axisFromBoneAxis(forwardAxis) !== primaryAxis) continue;

    const forwardLabel = BONE_AXIS_LABELS[forwardAxis] ?? String(forwardAxis);
    const primaryLabel = VECTOR3_AXIS_LABELS[primaryAxis] ?? String(primaryAxis);
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
    emits: [{ ruleName: 'aimmodifier3d-parallel-rotation-axes', severity: 'warning' }],
  },
  check: checkAimModifier3D,
};

ruleRegistry.register(aimModifier3DAxisRule);

export { aimModifier3DAxisRule };
