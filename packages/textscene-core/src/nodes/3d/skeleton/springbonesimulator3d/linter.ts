/**
 * Semantic linter rules for SpringBoneSimulator3D.
 *
 * Format and range validation is linterParser.ts's, which checks each
 * `settings/<i>/…` leaf in isolation. This file holds the claims that need a
 * SIBLING property to be decidable, so no per-property validator can make them.
 * All four are conditions Godot's own saver cannot produce: it writes the count
 * ahead of the leaves and `_validate_dynamic_prop` (spring_bone_simulator_3d.cpp
 * :348) strips whichever half of each pair is inert, so every one of these fires
 * only against a hand-edited or converted scene.
 *
 * ## A setting index at or past `setting_count`
 *
 * `_set` opens with `ERR_FAIL_INDEX_V(which, (int)settings.size(), false)`
 * (:44), and `settings` is resized only by `set_setting_count` (:840), the body
 * behind `setting_count`. An index at or past that count is refused, so every
 * leaf under it is dropped on load. The validator already errors on a NEGATIVE
 * index against the same guard; only the high end needs the sibling.
 *
 * ## The two config modes, each of which silently drops the other's block
 *
 * `individual_config` chooses whether one shared radius/stiffness/drag/gravity
 * block drives the whole chain or each joint carries its own. Both directions
 * are enforced by an early return rather than by a value check:
 * `set_radius` and its eight siblings return when the setting IS individual
 * (:644, :658, :678, :692, :712, :726, :746, :760, :781, :795, :810), and
 * `set_joint_radius` and its five siblings return when it is NOT (:914, :934,
 * :951, :968, :1003, :1029). Either way the write vanishes with nothing
 * surfaced, which is the case ADR-0032 grounds a diagnostic on.
 *
 * `joints/<j>/bone` and `bone_name` are exempt from the second check: those two
 * are refused in BOTH modes and Godot writes them itself in the shared one
 * (linterParser.ts records the `usage ^= PROPERTY_USAGE_STORAGE` that puts them
 * in the file), so flagging them would fire on engine output.
 *
 * ## The collision list that is not the live one
 *
 * `enable_all_child_collisions` selects between an explicit collision list and
 * an exclusion list over every child. `set_collision_path` (:1150-1152) and
 * `set_collision_count` (:1181-1183) return when it is true;
 * `set_exclude_collision_path` (:1094-1096) and `set_exclude_collision_count`
 * (:1125-1127) return when it is false. Its default is `true`
 * (spring_bone_simulator_3d.h:145), so an ABSENT key means the exclusion list is
 * the live one and an explicit `collisions/<j>` beside it is dropped.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../linter/nodeBaseTypes.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';

/** Any `settings/<i>/…` leaf, whatever its depth. */
const SETTING_KEY_RE = /^settings\/([+-]?\d+)\/(.+)$/;
/** `<leaf>` below a joint index, for the individual-mode check. */
const JOINT_KEY_RE = /^joints\/[+-]?\d+\/(.+)$/;

/**
 * The first segment below the setting index for every leaf the SHARED block
 * owns, exactly the list `_validate_dynamic_prop` hides when the config is
 * individual (:373-376). Matching on that segment covers `radius/value` and
 * `radius/damping_curve` at once, as the engine's own `split[2]` test does.
 */
const SHARED_CONFIG_SEGMENTS: ReadonlySet<string> = new Set([
  'rotation_axis',
  'rotation_axis_vector',
  'radius',
  'stiffness',
  'drag',
  'gravity',
]);

/**
 * The per-joint leaves whose setters return unless the config is individual.
 * `bone` and `bone_name` are absent on purpose: see the file header.
 */
const JOINT_CONFIG_LEAVES: ReadonlySet<string> = new Set([
  'rotation_axis',
  'rotation_axis_vector',
  'radius',
  'stiffness',
  'drag',
  'gravity',
  'gravity_direction',
]);

/** Leaves that only land while `enable_all_child_collisions` is false. */
const EXPLICIT_COLLISION_RE = /^collisions\/[+-]?\d+$|^collision_count$/;
/** Leaves that only land while `enable_all_child_collisions` is true. */
const EXCLUDE_COLLISION_RE = /^exclude_collisions\/[+-]?\d+$|^exclude_collision_count$/;

/** A `.tscn` boolean, or the C++ default when the key is absent. */
function readBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  return raw.trim() === 'true';
}

/** `indices` as `0, 2, 5`, ascending, for a message. */
function list(indices: Set<number>): string {
  return [...indices].sort((a, b) => a - b).join(', ');
}

function checkSpringBoneSimulator3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;
  if (!isValidProperties(node.properties)) return diagnostics;
  const rawProps = node.properties as Record<string, string>;

  // Absent means zero: `LocalVector<SpringBone3DSetting *> settings`
  // (spring_bone_simulator_3d.h:157) starts empty, which is the XML's default="0".
  const countRaw = rawProps.setting_count;
  const count = ruleInt(countRaw, 0);
  // Neither an unreadable count nor a non-finite one is a ceiling to count
  // against; each is already its own validator's diagnostic.
  if (count === null) return diagnostics;

  const outOfRange = new Set<number>();
  const sharedIgnored = new Set<number>();
  const jointIgnored = new Set<number>();
  const collisionIgnored = new Set<number>();
  const excludeIgnored = new Set<number>();

  for (const key of Object.keys(rawProps)) {
    const indexed = SETTING_KEY_RE.exec(key);
    if (!indexed) continue;
    const indexText = indexed[1]!;
    const leaf = indexed[2]!;
    const index = Number(indexText);
    // A negative index is the validator's error, against the same
    // ERR_FAIL_INDEX_V; reporting it again here would double up on one defect.
    if (index < 0) continue;
    if (index >= count) outOfRange.add(index);

    // Read every sibling back through the index TEXT, so `settings/00/…` finds
    // its own siblings rather than `settings/0/…`.
    const individual = readBool(rawProps[`settings/${indexText}/individual_config`], false);
    const allChildCollisions = readBool(
      rawProps[`settings/${indexText}/enable_all_child_collisions`],
      true,
    );

    const joint = JOINT_KEY_RE.exec(leaf);
    if (joint) {
      if (!individual && JOINT_CONFIG_LEAVES.has(joint[1]!)) jointIgnored.add(index);
    } else if (individual && SHARED_CONFIG_SEGMENTS.has(leaf.split('/')[0]!)) {
      sharedIgnored.add(index);
    }

    if (allChildCollisions && EXPLICIT_COLLISION_RE.test(leaf)) collisionIgnored.add(index);
    if (!allChildCollisions && EXCLUDE_COLLISION_RE.test(leaf)) excludeIgnored.add(index);
  }

  if (outOfRange.size > 0) {
    diagnostics.push({
      severity: 'error',
      message:
        `SpringBoneSimulator3D setting index(es) ${list(outOfRange)} fall outside ` +
        `setting_count (${count}). SpringBoneSimulator3D::_set opens with ` +
        'ERR_FAIL_INDEX_V(which, settings.size(), false) (spring_bone_simulator_3d.cpp:44), ' +
        'so no setter runs and these settings/<i>/… values are silently dropped on load.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'springbonesimulator3d-setting-index-out-of-range',
    });
  }

  if (sharedIgnored.size > 0) {
    diagnostics.push({
      severity: 'error',
      message:
        `SpringBoneSimulator3D setting(s) ${list(sharedIgnored)} carry the shared ` +
        'rotation_axis/radius/stiffness/drag/gravity block while individual_config is true. ' +
        'set_radius and its siblings return before assigning whenever the config is ' +
        'individual (spring_bone_simulator_3d.cpp:644), so the values are dropped and the ' +
        'settings/<i>/joints/<j>/… block drives the chain instead.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'springbonesimulator3d-shared-config-ignored',
    });
  }

  if (jointIgnored.size > 0) {
    diagnostics.push({
      severity: 'error',
      message:
        `SpringBoneSimulator3D setting(s) ${list(jointIgnored)} tune ` +
        'settings/<i>/joints/<j>/… while individual_config is false. set_joint_radius and ' +
        'its siblings return before assigning unless the config is individual ' +
        '(spring_bone_simulator_3d.cpp:914), and _update_joints then overwrites the joint ' +
        'list from the shared block, so these values never reach the simulation.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'springbonesimulator3d-joint-config-ignored',
    });
  }

  if (collisionIgnored.size > 0) {
    diagnostics.push({
      severity: 'error',
      message:
        `SpringBoneSimulator3D setting(s) ${list(collisionIgnored)} carry an explicit ` +
        'collision list while enable_all_child_collisions is true (its default, ' +
        'spring_bone_simulator_3d.h:145). set_collision_path returns before storing the ' +
        'path in that state (spring_bone_simulator_3d.cpp:1150-1152), so the list is ' +
        'dropped; set exclude_collisions instead, or turn the flag off.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'springbonesimulator3d-collision-list-ignored',
    });
  }

  if (excludeIgnored.size > 0) {
    diagnostics.push({
      severity: 'error',
      message:
        `SpringBoneSimulator3D setting(s) ${list(excludeIgnored)} carry an exclude ` +
        'collision list while enable_all_child_collisions is false. ' +
        'set_exclude_collision_path returns before storing the path in that state ' +
        '(spring_bone_simulator_3d.cpp:1094-1096), so the exclusions are dropped and only ' +
        'the explicit collisions list is consulted.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'springbonesimulator3d-collision-list-ignored',
    });
  }

  return diagnostics;
}

const springBoneSimulator3DValidationRule: LintRule = {
  meta: {
    name: 'valid-springbonesimulator3d-settings',
    description:
      "Validates SpringBoneSimulator3D's settings/<i>/… indices against setting_count, its " +
      'two config modes against individual_config, and its two collision lists against ' +
      'enable_all_child_collisions',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'SpringBoneSimulator3D'),
    emits: [
      {
        ruleName: 'springbonesimulator3d-setting-index-out-of-range',
        severity: 'error',
        grounding: { kind: 'engine', at: 'spring_bone_simulator_3d.cpp:44' },
      },
      {
        ruleName: 'springbonesimulator3d-shared-config-ignored',
        severity: 'error',
        grounding: { kind: 'engine', at: 'spring_bone_simulator_3d.cpp:644' },
      },
      {
        ruleName: 'springbonesimulator3d-joint-config-ignored',
        severity: 'error',
        grounding: { kind: 'engine', at: 'spring_bone_simulator_3d.cpp:914' },
      },
      {
        ruleName: 'springbonesimulator3d-collision-list-ignored',
        severity: 'error',
        grounding: { kind: 'engine', at: 'spring_bone_simulator_3d.cpp:1150' },
      },
    ],
  },
  check: checkSpringBoneSimulator3D,
};

ruleRegistry.register(springBoneSimulator3DValidationRule);

export { springBoneSimulator3DValidationRule };
