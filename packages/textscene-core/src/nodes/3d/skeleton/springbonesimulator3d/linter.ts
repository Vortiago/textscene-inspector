/**
 * Semantic linter rules for SpringBoneSimulator3D: the claims that need a sibling property, which
 * no per-property validator in linterParser.ts can make. Godot's own saver writes the count ahead
 * of the leaves, and `_validate_dynamic_prop` (spring_bone_simulator_3d.cpp :348) strips the inert
 * half of each pair, so each rule fires only on a hand-edited or converted scene.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { listWrittenIndices } from '../../../../linter/reportedIndices.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { ruleCount } from '../../../../linter/validators/commonValidators.js';
import {
  boolSlotValue,
  declaredLeafResolver,
  indexedElements,
  indexedKeyRegex,
  stringToInt,
} from '../../../../godot/index.js';
import { SETTING_LEAVES } from './settingLeaves.js';

/**
 * Any `settings/<i>/…` leaf, whatever its depth. Every index position here (the setting, the joint,
 * the collision) is read with a bare `path.get_slicec('/', n).to_int()` and no validity gate
 * (spring_bone_simulator_3d.cpp:42, :122, :143, :147), so {@link stringToInt} reads the whole
 * segment as the `int` Godot stores.
 */
const SETTING_KEY_RE = indexedKeyRegex('^settings/(#)/(.+)$', 'to_int');
/**
 * The segment below a joint index, for the individual-mode check. `prop = get_slicec('/', 4)`
 * (:123) reads that segment alone, so `joints/0/radius/extra` reaches set_joint_radius.
 */
const JOINT_KEY_RE = indexedKeyRegex('^joints/#/([^/]+)', 'to_int');

/**
 * The `settings/<i>/<leaf>` leaf a key reaches through a tail `_set` ignores:
 * `individual_config/extra` is `individual_config` (:73), and `radius/extra` reaches none (:85).
 */
const resolveSettingLeaf = declaredLeafResolver(Object.keys(SETTING_LEAVES));

/**
 * The first segment below the setting index for every leaf of the shared block, the list
 * `_validate_dynamic_prop` hides when the config is individual (:373-376). set_radius and its eight
 * siblings return when the setting is individual (:644, :658, :678, :692, :712, :726, :746, :760,
 * :781, :795, :810).
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
 * The per-joint leaves whose setters return unless the config is individual (:914, :934, :951,
 * :968, :1003, :1029). Either way the write vanishes silently, which ADR-0032 grounds a diagnostic
 * on. `bone` and `bone_name` are absent: both are refused in either mode, and Godot writes them
 * itself in shared mode (see jointLeaves.ts).
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

/**
 * The `what` segments that land only while `enable_all_child_collisions` is false:
 * set_collision_path (:1150-1152) and set_collision_count (:1181-1183) return when it is true.
 * Neither branch reads an option below `what` (:146-150), so a tail reaches the setter, and a
 * missing collision index is `"".to_int()`, collision 0.
 */
const EXPLICIT_COLLISION_SEGMENTS: ReadonlySet<string> = new Set(['collisions', 'collision_count']);
/**
 * The `what` segments that land only while `enable_all_child_collisions` is true:
 * set_exclude_collision_path (:1094-1096) and set_exclude_collision_count (:1125-1127) return
 * when it is false.
 */
const EXCLUDE_COLLISION_SEGMENTS: ReadonlySet<string> = new Set([
  'exclude_collisions',
  'exclude_collision_count',
]);

/** A `.tscn` boolean, or the C++ default when the key is absent. */
function readBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  return boolSlotValue(raw) === true;
}

function checkSpringBoneSimulator3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node } = context;
  if (!isValidProperties(node.properties)) return diagnostics;
  const rawProps = node.properties as Record<string, string>;

  // Absent means zero: `LocalVector<SpringBone3DSetting *> settings`
  // (spring_bone_simulator_3d.h:157) starts empty, which is the XML's default="0".
  const countRaw = rawProps.setting_count;
  const count = ruleCount(countRaw);
  // Neither an unreadable count nor a non-finite one is a ceiling to count
  // against; each is already its own validator's diagnostic.
  if (count === null) return diagnostics;

  // Keyed by each index text as the file writes it, to the setting it resolves to.
  const outOfRange = new Map<string, number>();
  const sharedIgnored = new Map<string, number>();
  const jointIgnored = new Map<string, number>();
  const collisionIgnored = new Map<string, number>();
  const excludeIgnored = new Map<string, number>();

  // Grouped by the setting `_set` resolves each key to, so `settings/00/…` and `settings/0/…` are
  // one setting and every leaf finds the siblings written beside it under either spelling.
  const settings = indexedElements(rawProps, 'settings/', 'to_int', resolveSettingLeaf);

  for (const key of Object.keys(rawProps)) {
    const indexed = SETTING_KEY_RE.exec(key);
    if (!indexed) continue;
    const indexText = indexed[1]!;
    const leaf = indexed[2]!;
    const index = stringToInt(indexText);
    // A negative index is the validator's error, against the same ERR_FAIL_INDEX_V, and reporting
    // it again here would double up on one defect.
    if (index < 0) continue;
    // `_set` opens with `ERR_FAIL_INDEX_V(which, (int)settings.size(), false)` (:44), and only
    // `set_setting_count` (:840) resizes `settings`, so every leaf at or past the count is dropped
    // on load.
    if (index >= count) {
      outOfRange.set(indexText, index);
      // The refusal comes first, so no leaf here reaches the mode-gated setters below.
      continue;
    }

    const siblings = settings.get(index);
    const individual = readBool(siblings?.get('individual_config'), false);
    // `enable_all_child_collisions` defaults to true (spring_bone_simulator_3d.h:145), so an absent
    // key makes the exclusion list the live one.
    const allChildCollisions = readBool(siblings?.get('enable_all_child_collisions'), true);

    // `what = get_slicec('/', 2)` (:43), the segment every branch of `_set` tests.
    const what = leaf.split('/')[0]!;
    const joint = JOINT_KEY_RE.exec(leaf);
    if (joint) {
      if (!individual && JOINT_CONFIG_LEAVES.has(joint[1]!)) jointIgnored.set(indexText, index);
    } else if (individual && SHARED_CONFIG_SEGMENTS.has(what)) {
      // Only a key that reaches a setter is dropped by its mode gate. `radius/extra` is refused
      // earlier (:85), and the validator already reports it unknown.
      if (resolveSettingLeaf(leaf) !== null) sharedIgnored.set(indexText, index);
    }

    if (allChildCollisions && EXPLICIT_COLLISION_SEGMENTS.has(what)) {
      collisionIgnored.set(indexText, index);
    }
    if (!allChildCollisions && EXCLUDE_COLLISION_SEGMENTS.has(what)) {
      excludeIgnored.set(indexText, index);
    }
  }

  if (outOfRange.size > 0) {
    diagnostics.push({
      severity: 'error',
      message:
        `SpringBoneSimulator3D setting index(es) ${listWrittenIndices(outOfRange)} fall outside ` +
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
        `SpringBoneSimulator3D setting(s) ${listWrittenIndices(sharedIgnored)} carry the shared ` +
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
        `SpringBoneSimulator3D setting(s) ${listWrittenIndices(jointIgnored)} tune ` +
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
        `SpringBoneSimulator3D setting(s) ${listWrittenIndices(collisionIgnored)} carry an explicit ` +
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
        `SpringBoneSimulator3D setting(s) ${listWrittenIndices(excludeIgnored)} carry an exclude ` +
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
