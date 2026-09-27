/**
 * Semantic linter rules for TwoBoneIK3D: the claims that need a sibling property, which no
 * per-property validator in linterParser.ts can make. Godot's own saver writes `setting_count`
 * (`ADD_ARRAY_COUNT`, two_bone_ik_3d.cpp:506) ahead of the leaves `_get_property_list` appends, so
 * an index past the count appears only in a hand-edited scene.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties, extractNodePath } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { ruleCount, ruleInt } from '../../../../linter/validators/commonValidators.js';
import {
  listIndices,
  listWrittenIndices,
  unsatisfiedIndices,
} from '../../../../linter/reportedIndices.js';
import { indexedElements, indexedKeyRegex, stringToInt } from '../../../../godot/index.js';
import { resolveTwoBoneSettingLeaf } from './linterParser.js';

/**
 * Any `settings/<i>/…` key, its index and the path below it captured. `_set` reads the index with a
 * bare `path.get_slicec('/', 1).to_int()` into an `int` and no validity gate (two_bone_ik_3d.cpp:37),
 * so {@link stringToInt} reads the whole segment. This regex and `indexedElements` share the
 * grammar, so a key it admits is always one its siblings can look up.
 */
const SETTING_KEY_RE = indexedKeyRegex('^settings/(#)/(.*)$', 'to_int');

/** `SECONDARY_DIRECTION_CUSTOM`, skeleton_modifier_3d.h:75. */
const SECONDARY_DIRECTION_CUSTOM = 7;
/** `SecondaryDirection pole_direction = SECONDARY_DIRECTION_NONE`, two_bone_ik_3d.h:53. */
const SECONDARY_DIRECTION_NONE = 0;

function checkTwoBoneIK3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;
  if (!isValidProperties(node.properties)) return diagnostics;
  const rawProps = node.properties as Record<string, string>;

  // Absent means zero: `LocalVector<IKModifier3DSetting *> settings`
  // (ik_modifier_3d.h:69) starts empty, which is the XML's default="0".
  const countRaw = rawProps.setting_count;
  const count = ruleCount(countRaw);
  // Neither an unreadable count nor a non-finite one is a ceiling to count
  // against; each is already its own validator's diagnostic.
  if (count === null) return diagnostics;

  // Keyed by each index text as the file writes it, to the setting it resolves to.
  const outOfRange = new Map<string, number>();
  const ignoredVectors = new Map<string, number>();

  // Grouped by the setting `_set` resolves each key to, not by its text: the bare `to_int`
  // (two_bone_ik_3d.cpp:37) has no `is_valid_int` gate, so `settings/00/…` and `settings/0/…`
  // address the same setting.
  const settings = indexedElements(rawProps, 'settings/', 'to_int', resolveTwoBoneSettingLeaf);

  // Absence is the trigger too, since `target_node` is empty by default (two_bone_ik_3d.h), so
  // every setting in range counts. Derived, not walked: `setting_count` is an INT slot with no
  // ceiling, so `0..count` can be two billion iterations. See `reportedIndices.ts`.
  const targeted = new Set<number>();
  for (const [at, leaves] of settings) {
    const raw = leaves.get('target_node');
    // `unsatisfiedIndices` expects `satisfied` restricted to `0..count`. `indexedElements` holds
    // no negative index, which would inflate `satisfied.size` and cancel a missing target.
    if (raw !== undefined && at < count && extractNodePath(raw) !== null) targeted.add(at);
  }
  // `get_configuration_warnings()` (two_bone_ik_3d.cpp:194-206) runs two loops, and both test
  // `target_node.is_empty()`: the second, meant for the pole, never reads `pole_node`. One
  // condition, so one diagnostic here, not two.
  const missingTargets = unsatisfiedIndices(count, targeted);

  for (const key of Object.keys(rawProps)) {
    const indexed = SETTING_KEY_RE.exec(key);
    if (!indexed) continue;
    const indexText = indexed[1]!;
    const index = stringToInt(indexText);
    // A negative index is the validator's error, against the same ERR_FAIL_INDEX_V, so it is not
    // reported twice.
    if (index < 0) continue;
    // `_set` opens with `ERR_FAIL_INDEX_V(which, (int)settings.size(), false)`
    // (two_bone_ik_3d.cpp:39), and only `_set_setting_count` (ik_modifier_3d.h:97-114) resizes
    // `settings`, so every leaf at or past the count is dropped on load.
    if (index >= count) {
      outOfRange.set(indexText, index);
      // The refusal comes first, so a vector here never reaches its own setter.
      continue;
    }

    // The one leaf whose write depends on a sibling: `set_pole_direction_vector`
    // (two_bone_ik_3d.cpp:444-448) returns unless `pole_direction` is `SECONDARY_DIRECTION_CUSTOM`,
    // dropping the write silently (ADR-0032). `_validate_dynamic_prop` (two_bone_ik_3d.cpp:186-188)
    // hides the key in that state, and the getter returns the axis the enum names.
    if (resolveTwoBoneSettingLeaf(indexed[2]!) !== 'pole_direction_vector') continue;
    const directionRaw = settings.get(index)?.get('pole_direction');
    const direction = ruleInt(directionRaw, SECONDARY_DIRECTION_NONE);
    if (direction === null) continue;
    if (direction !== SECONDARY_DIRECTION_CUSTOM) ignoredVectors.set(indexText, index);
  }

  if (outOfRange.size > 0) {
    const indices = listWrittenIndices(outOfRange);
    diagnostics.push({
      severity: 'error',
      message:
        `TwoBoneIK3D setting index(es) ${indices} fall outside setting_count (${count}). ` +
        'TwoBoneIK3D::_set opens with ERR_FAIL_INDEX_V(which, settings.size(), false) ' +
        '(two_bone_ik_3d.cpp:39), so no setter runs and these settings/<i>/… values are ' +
        'silently dropped on load.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'twoboneik3d-setting-index-out-of-range',
    });
  }

  if (missingTargets.total > 0) {
    const indices = listIndices(missingTargets.listed, missingTargets.total);
    diagnostics.push({
      severity: 'warning',
      message:
        `TwoBoneIK3D setting(s) ${indices} have no target_node. TwoBoneIK3D must have a target ` +
        'to work (two_bone_ik_3d.cpp:196).',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'twoboneik3d-setting-missing-target-node',
    });
  }

  if (ignoredVectors.size > 0) {
    const indices = listWrittenIndices(ignoredVectors);
    diagnostics.push({
      severity: 'error',
      message:
        `TwoBoneIK3D setting(s) ${indices} set pole_direction_vector while pole_direction is ` +
        'not Custom (7). set_pole_direction_vector returns before assigning unless the ' +
        'direction is SECONDARY_DIRECTION_CUSTOM (two_bone_ik_3d.cpp:446), so the vector is ' +
        'dropped and get_pole_direction_vector keeps returning the axis the enum names.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'twoboneik3d-pole-direction-vector-ignored',
    });
  }

  return diagnostics;
}

const twoBoneIK3DValidationRule: LintRule = {
  meta: {
    name: 'valid-twoboneik3d-settings',
    description:
      "Validates TwoBoneIK3D's settings/<i>/… indices against setting_count and its pole direction vector against pole_direction",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'TwoBoneIK3D'),
    emits: [
      {
        ruleName: 'twoboneik3d-setting-index-out-of-range',
        severity: 'error',
        grounding: { kind: 'engine', at: 'two_bone_ik_3d.cpp:39' },
      },
      {
        ruleName: 'twoboneik3d-pole-direction-vector-ignored',
        severity: 'error',
        grounding: { kind: 'engine', at: 'two_bone_ik_3d.cpp:446' },
      },
      { ruleName: 'twoboneik3d-setting-missing-target-node', severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkTwoBoneIK3D,
};

ruleRegistry.register(twoBoneIK3DValidationRule);

export { twoBoneIK3DValidationRule };
