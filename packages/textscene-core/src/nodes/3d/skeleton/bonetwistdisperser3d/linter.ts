/**
 * BoneTwistDisperser3D's two rules that need a sibling property: an index past the count that sizes
 * its container, which Godot refuses, at two depths. Godot's saver cannot trip either: `setting_count`
 * is ClassDB-bound (`ADD_ARRAY_COUNT`, :561), so `Object::get_property_list` puts it ahead of the
 * leaves, and both counts are read off the live vectors at save time.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { listIndices } from '../../../../linter/reportedIndices.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { ruleCount } from '../../../../linter/validators/commonValidators.js';
import { indexedKeyRegex, toIntIndex } from '../../../../godot/index.js';

/**
 * Any `settings/<i>/…` leaf, with the index text captured. `_set` reads both index positions with a
 * bare `path.get_slicec('/', n).to_int()` and no validity gate (bone_twist_disperser_3d.cpp:37, :66),
 * so the grammar is the whole segment and {@link toIntIndex} turns it into a number.
 */
const SETTING_KEY_RE = indexedKeyRegex('^settings/(#)/', 'to_int');
/** The one nested leaf a scene can write, with both index texts captured. */
const JOINT_AMOUNT_KEY_RE = indexedKeyRegex('^settings/(#)/joints/(#)/twist_amount$', 'to_int');
/** The per-setting joint array size, which every joint index is measured against. */
const JOINT_COUNT_KEY_RE = indexedKeyRegex('^settings/(#)/joint_count$', 'to_int');

/**
 * Which setting each `joint_count` key sizes, keyed by the resolved index, not the text: `_set` uses
 * `to_int` (bone_twist_disperser_3d.cpp:37), so `settings/00/joint_count` sizes setting 0. A later
 * key wins, as `Object.keys` keeps insertion order and Godot applies properties in file order.
 */
function resolveJointCounts(properties: Record<string, string>): Map<number, number> {
  const counts = new Map<number, number>();
  for (const key of Object.keys(properties)) {
    const match = JOINT_COUNT_KEY_RE.exec(key);
    if (!match) continue;
    const settingIndex = toIntIndex(match[1]!);
    // A negative index is refused before the count is read at all.
    if (settingIndex < 0) continue;
    // A malformed count is its own validator's error. Ignoring it here leaves
    // the setting at its zero default rather than inventing a ceiling. A
    // negative one is refused outright (`ERR_FAIL_COND(p_count < 0)`, :487), so
    // `ruleCount` reads the size the vector keeps rather than the authored text.
    const count = ruleCount(properties[key]);
    if (count === null) continue;
    counts.set(settingIndex, count);
  }
  return counts;
}

function checkBoneTwistDisperser3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;
  if (!isValidProperties(node.properties)) return diagnostics;
  const rawProps = node.properties as Record<string, string>;

  // Absent means zero: `LocalVector<BoneTwistDisperser3DSetting *> settings`
  // (bone_twist_disperser_3d.h:86) starts empty, which is the XML's default="0".
  const settingCountRaw = rawProps.setting_count;
  // `ruleCount`, not `ruleInt`: `set_setting_count` refuses a negative (`ERR_FAIL_COND(p_count < 0)`,
  // :650), so `settings` keeps its loaded length. Counting against -1 names a size Godot never held,
  // beside the `enforced:` validator that already errored.
  const settingCount = ruleCount(settingCountRaw);
  // Neither an unreadable count nor a non-finite one is a ceiling to count
  // against. Each is already its own validator's diagnostic.
  if (settingCount === null) return diagnostics;

  const jointCounts = resolveJointCounts(rawProps);
  const outOfRangeSettings = new Set<number>();
  /** `[setting index, joint index]` pairs, so one message can list them all. */
  const outOfRangeJoints: [number, number][] = [];

  for (const key of Object.keys(rawProps)) {
    const indexed = SETTING_KEY_RE.exec(key);
    if (!indexed) continue;
    const settingIndex = toIntIndex(indexed[1]!);
    // A negative index is the validator's error, against the same
    // ERR_FAIL_INDEX_V. Reporting it again here would double up on one defect.
    if (settingIndex < 0) continue;
    // `_set` opens with `ERR_FAIL_INDEX_V(which, (int)settings.size(), false)`
    // (bone_twist_disperser_3d.cpp:39), and only `set_setting_count` (:649-666) resizes `settings`,
    // so every leaf of an index at or past the count is dropped on load.
    if (settingIndex >= settingCount) {
      outOfRangeSettings.add(settingIndex);
      // The whole setting is refused, so its joints never get their own turn.
      continue;
    }

    const joint = JOINT_AMOUNT_KEY_RE.exec(key);
    if (!joint) continue;
    const jointIndex = toIntIndex(joint[2]!);
    if (jointIndex < 0) continue;
    // `set_joint_twist_amount` guards with `ERR_FAIL_INDEX(p_joint, (int)joints.size())` (:502), and
    // only `set_joint_count` (:485-491) resizes it. The file's count governs: it is pushed (:158) before
    // its joints (:159-164), and `_update_joints` waits for ENTER_TREE (:220-222, :597). Absent means
    // zero: `LocalVector<DisperseJointSetting> joints` (bone_twist_disperser_3d.h:69) starts empty.
    const jointCount = jointCounts.get(settingIndex) ?? 0;
    if (jointIndex >= jointCount) outOfRangeJoints.push([settingIndex, jointIndex]);
  }

  if (outOfRangeSettings.size > 0) {
    const indices = listIndices([...outOfRangeSettings].sort((a, b) => a - b));
    diagnostics.push({
      severity: 'error',
      message:
        `BoneTwistDisperser3D setting index(es) ${indices} fall outside setting_count ` +
        `(${settingCount}). BoneTwistDisperser3D::_set opens with ERR_FAIL_INDEX_V(which, ` +
        'settings.size(), false) (bone_twist_disperser_3d.cpp:39), so no setter runs and ' +
        'these settings/<i>/… values are silently dropped on load.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'bonetwistdisperser3d-setting-index-out-of-range',
    });
  }

  if (outOfRangeJoints.length > 0) {
    // Numeric on both halves: a lexicographic sort puts `0/10` before `0/2`.
    const pairs = outOfRangeJoints
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .map(([setting, joint]) => `${setting}/${joint}`)
      .join(', ');
    diagnostics.push({
      severity: 'error',
      message:
        `BoneTwistDisperser3D joint(s) ${pairs} (setting/joint) ` +
        'set twist_amount past their own joint_count. set_joint_twist_amount guards with ' +
        'ERR_FAIL_INDEX(p_joint, joints.size()) (bone_twist_disperser_3d.cpp:502) and the ' +
        'vector is sized only by joint_count (:485-491), so the amount is dropped on load.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'bonetwistdisperser3d-joint-index-out-of-range',
    });
  }

  return diagnostics;
}

// No rule for `damping_curve` beside `joints/<j>/twist_amount`: `_update_curve` (:389-399) overwrites
// each amount from the curve, but `_validate_dynamic_prop` only adds `PROPERTY_USAGE_READ_ONLY`
// (:208-210) and keeps STORAGE, so Godot writes the pair on every save that uses a curve.
const boneTwistDisperser3DValidationRule: LintRule = {
  meta: {
    name: 'valid-bonetwistdisperser3d-settings',
    description:
      "Validates BoneTwistDisperser3D's settings/<i>/… indices against setting_count and its joint twist amounts against each setting's joint_count",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'BoneTwistDisperser3D'),
    emits: [
      {
        ruleName: 'bonetwistdisperser3d-setting-index-out-of-range',
        severity: 'error',
        grounding: { kind: 'engine', at: 'bone_twist_disperser_3d.cpp:39' },
      },
      {
        ruleName: 'bonetwistdisperser3d-joint-index-out-of-range',
        severity: 'error',
        grounding: { kind: 'engine', at: 'bone_twist_disperser_3d.cpp:502' },
      },
    ],
  },
  check: checkBoneTwistDisperser3D,
};

ruleRegistry.register(boneTwistDisperser3DValidationRule);

export { boneTwistDisperser3DValidationRule };
