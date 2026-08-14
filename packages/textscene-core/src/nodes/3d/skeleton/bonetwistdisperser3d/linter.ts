/**
 * Semantic linter rules for BoneTwistDisperser3D.
 *
 * Format and range validation is linterParser.ts's, which checks each
 * `settings/<i>/…` key in isolation. This file holds the two claims that need a
 * SIBLING property to be decidable, so no per-property validator can make them.
 * Both are the same defect at two nesting depths: an index past the count that
 * sizes its container, which Godot refuses outright.
 *
 * ## A setting index past `setting_count`
 *
 * `BoneTwistDisperser3D::_set` opens with `ERR_FAIL_INDEX_V(which,
 * (int)settings.size(), false)` (bone_twist_disperser_3d.cpp:39), and `settings`
 * is resized only by `set_setting_count` (:649-666), the body behind the
 * `ADD_ARRAY_COUNT` key. An index at or past that count is refused, so every
 * leaf under it is dropped on load. The validator already errors on a NEGATIVE
 * index against the same guard; only the high end needs the sibling.
 *
 * ## A joint index past that setting's `joint_count`
 *
 * `set_joint_twist_amount` guards with `ERR_FAIL_INDEX(p_joint,
 * (int)joints.size())` (:502), and that vector is resized only by
 * `set_joint_count` (:485-491), the body behind `settings/<i>/joint_count`.
 * Load order makes the file's own `joint_count` the one that governs:
 * `_get_property_list` pushes it (:158) before the joints it counts (:159-164),
 * and `_update_joints`, which later rebuilds the list from the skeleton, is
 * deferred to NOTIFICATION_ENTER_TREE (:220-222, :597).
 *
 * ## Why Godot's own saver cannot trip either
 *
 * `setting_count` is ClassDB-bound (`ADD_ARRAY_COUNT`, :561), so
 * `Object::get_property_list` places it ahead of the leaves
 * `_get_property_list` appends, and both counts are read straight off the live
 * vectors at save time. These fire only against a hand-edited scene.
 *
 * ## What is deliberately NOT a rule here
 *
 * A `damping_curve` alongside `joints/<j>/twist_amount` looks like a conflict:
 * `_update_curve` (:389-399) overwrites every `custom_amount` from the curve, so
 * the file's amounts are outputs rather than inputs. But
 * `_validate_dynamic_prop` only adds `PROPERTY_USAGE_READ_ONLY` in that state
 * (:208-210), never clearing `PROPERTY_USAGE_STORAGE`, so Godot writes the pair
 * on every save that uses a curve. Warning on it would fire on scenes the engine
 * itself produced.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';
import { parseGodotInt } from '../../../../linter/validators/commonValidators.js';

/** Any `settings/<i>/…` leaf, whatever its depth, with the index text captured. */
const SETTING_KEY_RE = /^settings\/([+-]?\d+)\//;
/** The one nested leaf a scene can write, with both index texts captured. */
const JOINT_AMOUNT_KEY_RE = /^settings\/([+-]?\d+)\/joints\/([+-]?\d+)\/twist_amount$/;
/** The per-setting joint array size, which every joint index is measured against. */
const JOINT_COUNT_KEY_RE = /^settings\/([+-]?\d+)\/joint_count$/;

/**
 * Which setting each `joint_count` key actually sizes, keyed by the RESOLVED
 * index rather than the text.
 *
 * `_set` resolves the index with `to_int` (bone_twist_disperser_3d.cpp:37), so
 * `settings/00/joint_count` and `settings/0/joint_count` size the same vector.
 * Matching on the text instead read a ceiling of zero for a key spelled `00`
 * and warned that a write Godot applies had been dropped. `Number` and `to_int`
 * agree on every form the regex above admits, digits with an optional sign.
 *
 * A later key wins, because `Object.keys` keeps insertion order and Godot
 * applies the properties in file order too.
 */
function resolveJointCounts(properties: Record<string, string>): Map<number, number> {
  const counts = new Map<number, number>();
  for (const key of Object.keys(properties)) {
    const match = JOINT_COUNT_KEY_RE.exec(key);
    if (!match) continue;
    const settingIndex = Number(match[1]);
    // A negative index is refused before the count is read at all.
    if (settingIndex < 0) continue;
    // A malformed count is its own validator's error; ignoring it here leaves
    // the setting at its zero default rather than inventing a ceiling.
    const count = parseGodotInt(properties[key] ?? '');
    if (count === null || Number.isNaN(count)) continue;
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
  const settingCount = settingCountRaw === undefined ? 0 : parseGodotInt(settingCountRaw);
  // A malformed setting_count is already reported by its own validator, and a
  // non-finite one is altered at parse; neither is a ceiling to count against.
  if (settingCount === null || Number.isNaN(settingCount)) return diagnostics;

  const jointCounts = resolveJointCounts(rawProps);
  const outOfRangeSettings = new Set<number>();
  /** `[setting index, joint index]` pairs, so one message can list them all. */
  const outOfRangeJoints: [number, number][] = [];

  for (const key of Object.keys(rawProps)) {
    const indexed = SETTING_KEY_RE.exec(key);
    if (!indexed) continue;
    const settingIndex = Number(indexed[1]);
    // A negative index is the validator's error, against the same
    // ERR_FAIL_INDEX_V; reporting it again here would double up on one defect.
    if (settingIndex < 0) continue;
    if (settingIndex >= settingCount) {
      outOfRangeSettings.add(settingIndex);
      // The whole setting is refused, so its joints never get their own turn.
      continue;
    }

    const joint = JOINT_AMOUNT_KEY_RE.exec(key);
    if (!joint) continue;
    const jointIndex = Number(joint[2]);
    if (jointIndex < 0) continue;
    // Absent means zero: `LocalVector<DisperseJointSetting> joints`
    // (bone_twist_disperser_3d.h:69) starts empty, so nothing is addressable
    // until a joint_count sizes it.
    const jointCount = jointCounts.get(settingIndex) ?? 0;
    if (jointIndex >= jointCount) outOfRangeJoints.push([settingIndex, jointIndex]);
  }

  if (outOfRangeSettings.size > 0) {
    const indices = [...outOfRangeSettings].sort((a, b) => a - b).join(', ');
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
