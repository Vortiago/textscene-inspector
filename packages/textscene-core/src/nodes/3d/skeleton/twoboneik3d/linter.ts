/**
 * Semantic linter rules for TwoBoneIK3D.
 *
 * Format and range validation is linterParser.ts's, which checks each
 * `settings/<i>/<leaf>` in isolation. This file holds the two claims that need a
 * SIBLING property to be decidable, so no per-property validator can make them.
 *
 * ## A setting index past `setting_count`
 *
 * `TwoBoneIK3D::_set` opens with `ERR_FAIL_INDEX_V(which, (int)settings.size(),
 * false)` (two_bone_ik_3d.cpp:39), and `settings` is resized only by
 * `_set_setting_count` (ik_modifier_3d.h:97-114), the body behind
 * `setting_count`. An index at or past that count is refused, so every leaf
 * under it is dropped on load. The validator already errors on a NEGATIVE index
 * against the same guard; only the high end needs the sibling, and that is what
 * lands here.
 *
 * Godot's own saver cannot produce this: `setting_count` is a ClassDB-bound
 * property (`ADD_ARRAY_COUNT`, two_bone_ik_3d.cpp:506), so
 * `Object::get_property_list` places it ahead of the leaves
 * `_get_property_list` appends, and the two stay in lockstep at runtime. It
 * fires only against a hand-edited scene.
 *
 * ## A pole direction vector that is never read
 *
 * `set_pole_direction_vector` (two_bone_ik_3d.cpp:444-448) returns immediately
 * unless that setting's `pole_direction` is `SECONDARY_DIRECTION_CUSTOM`
 * (skeleton_modifier_3d.h:75, value 7):
 *
 *   if (tb_settings[p_index]->pole_direction != SECONDARY_DIRECTION_CUSTOM) {
 *     return;
 *   }
 *
 * The write is dropped with nothing surfaced anywhere, which is the case
 * ADR-0032 grounds a diagnostic on. `_validate_dynamic_prop`
 * (two_bone_ik_3d.cpp:186-188) also clears the key to `PROPERTY_USAGE_NONE` in
 * exactly that state, so a scene Godot wrote never carries the pair, and
 * `get_pole_direction_vector` returns the axis the enum names rather than the
 * stored vector: what the file says and what the node does diverge silently.
 *
 * ## A setting with no target
 *
 * `get_configuration_warnings()` (two_bone_ik_3d.cpp:194-206) runs TWO loops
 * over `tb_settings`, each testing `target_node.is_empty()`:
 *
 *   for (...) if (tb_settings[i]->target_node.is_empty()) { push("no target set"); break; }
 *   for (...) if (tb_settings[i]->target_node.is_empty()) { push("no pole target set"); break; }
 *
 * The second loop is Godot's own copy-paste bug — it re-tests `target_node`
 * and never looks at `pole_node` at all, so "no pole target set" can never
 * fire for a reason distinct from the first message. One shared condition,
 * emitted as ONE diagnostic here rather than two mirroring the duplicated text.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties, extractNodePath } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { listIndices, unsatisfiedIndices } from '../../../../linter/reportedIndices.js';
import { indexedKeyRegex, toIntIndex } from '../../../../godot/index.js';

/**
 * Any `settings/<i>/…` leaf, whatever its depth.
 *
 * `_set` reads the index with a bare `path.get_slicec('/', 1).to_int()` and no
 * validity gate (two_bone_ik_3d.cpp:37), so the grammar is the whole segment
 * and {@link toIntIndex} is what turns it into a number. All four shapes here
 * share it deliberately: a key admitted by one and refused by another enters
 * the map under no index its sibling can look up.
 */
const SETTING_KEY_RE = indexedKeyRegex('^settings/(#)/', 'to_int');
/** The one leaf whose write depends on a sibling. */
const POLE_VECTOR_KEY_RE = indexedKeyRegex('^settings/(#)/pole_direction_vector$', 'to_int');
/** `target_node`, indexed canonically like `POLE_DIRECTION_KEY_RE` below. */
const TARGET_NODE_KEY_RE = indexedKeyRegex('^settings/(#)/target_node$', 'to_int');

/** The sibling a `pole_direction_vector` write depends on. */
const POLE_DIRECTION_KEY_RE = indexedKeyRegex('^settings/(#)/pole_direction$', 'to_int');

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
  const count = ruleInt(countRaw, 0);
  // Neither an unreadable count nor a non-finite one is a ceiling to count
  // against; each is already its own validator's diagnostic.
  if (count === null) return diagnostics;

  const outOfRange = new Set<number>();
  const ignoredVectors = new Set<number>();

  // `target_node`, indexed canonically for the same reason `poleDirections`
  // below is: `_set`'s bare `to_int` (two_bone_ik_3d.cpp:37) resolves
  // `settings/00/…` to the same setting as `settings/0/…`.
  const targetNodes = new Map<number, string>();
  for (const key of Object.keys(rawProps)) {
    const m = TARGET_NODE_KEY_RE.exec(key);
    if (!m) continue;
    const at = toIntIndex(m[1]!);
    if (Number.isFinite(at)) targetNodes.set(at, rawProps[key]!);
  }
  // Absence is the trigger too — `target_node` is empty by default
  // (two_bone_ik_3d.h) — so every setting IN RANGE counts, not only the keys a
  // scene happens to write. Derived rather than walked: `setting_count` is an
  // INT slot with no ceiling, so `0..count` really can be two billion
  // iterations. See `reportedIndices.ts`.
  const targeted = new Set<number>();
  for (const [at, raw] of targetNodes) {
    // `at >= 0` too: `unsatisfiedIndices` documents that `satisfied` is already
    // restricted to `0..count`, and a stray negative index otherwise inflates
    // `satisfied.size` and cancels a genuinely missing target.
    if (at >= 0 && at < count && extractNodePath(raw) !== null) targeted.add(at);
  }
  const missingTargets = unsatisfiedIndices(count, targeted);

  // `pole_direction` indexed CANONICALLY, by the number `_set` resolves the
  // index to, not by its text. `_set` reads it with a bare `to_int`
  // (two_bone_ik_3d.cpp:37) with no `is_valid_int` gate, so `settings/00/…` and
  // `settings/0/…` address the SAME setting. Matching on text instead made
  // `settings/00/pole_direction_vector` miss its own `settings/0/pole_direction`
  // and warn that Godot had ignored a vector it actually applies.
  const poleDirections = new Map<number, string>();
  for (const key of Object.keys(rawProps)) {
    const m = POLE_DIRECTION_KEY_RE.exec(key);
    if (!m) continue;
    const at = toIntIndex(m[1]!);
    if (Number.isFinite(at)) poleDirections.set(at, rawProps[key]!);
  }

  for (const key of Object.keys(rawProps)) {
    const indexed = SETTING_KEY_RE.exec(key);
    if (!indexed) continue;
    const index = toIntIndex(indexed[1]!);
    // A negative index is the validator's error, against the same
    // ERR_FAIL_INDEX_V; reporting it again here would double up on one defect.
    // Spelled against NaN too — `toIntIndex` surrenders a magnitude no double
    // names to it, and `NaN < 0` is false, so `index < 0` let one through into
    // the reported set.
    if (!(index >= 0)) continue;
    if (index >= count) outOfRange.add(index);

    const vector = POLE_VECTOR_KEY_RE.exec(key);
    if (!vector) continue;
    const directionRaw = poleDirections.get(index);
    const direction =
      ruleInt(directionRaw, SECONDARY_DIRECTION_NONE);
    if (direction === null) continue;
    if (direction !== SECONDARY_DIRECTION_CUSTOM) ignoredVectors.add(index);
  }

  if (outOfRange.size > 0) {
    const indices = listIndices([...outOfRange].sort((a, b) => a - b));
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
    const indices = listIndices([...ignoredVectors].sort((a, b) => a - b));
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
