/**
 * LookAtModifier3D strict validators for linting.
 *
 * Declare only LookAtModifier3D's OWN members — the ones doc/classes/LookAtModifier3D.xml
 * lists without an `overrides=` attribute. Everything from SkeletonModifier3D up is
 * registered on the ancestor and delivered by the NODE_BASE_TYPES base-walk, so
 * re-declaring an inherited key shadows it and duplicates the rule.
 *
 * All thirty keys arrive by ONE route, the `ADD_PROPERTY` block at
 * look_at_modifier_3d.cpp:468-508. The class declares no `_set`/`_get`, no
 * `get_property_list`, no `PropertyListHelper` and no `ADD_ARRAY_COUNT`, so
 * nothing else reaches a `.tscn`.
 *
 * Every setter in this class (look_at_modifier_3d.cpp:92-377) is a bare
 * assignment; only the two bone indices rewrite what they are given. So apart
 * from those two, every bound here is `hinted` and every out-of-range value is
 * a WARNING (ADR-0032): the PROPERTY_HINT_RANGE constrains the inspector
 * widget, and the engine loads the scene either way.
 *
 * `_validate_property` (:35-68) clears PROPERTY_USAGE on whole families — the
 * origin_bone keys unless `origin_from` is SpecificBone, every limit and damp
 * key unless `use_angle_limitation`, the `secondary_*` keys unless
 * `use_secondary_rotation`, and the symmetric/asymmetric halves against
 * `symmetry_limitation`. That hides them from the inspector and stops Godot
 * WRITING them; it never makes the setter refuse one, so a scene carrying a
 * hidden key still loads it and every key below is validated unconditionally.
 *
 * The angle family is the trap. Six properties hint `radians_as_degrees`, which
 * means the hint's numbers are DEGREES while the serialised value is RADIANS:
 * "0,180" stores 0..PI and "0,360" stores 0..TAU. `v.radians` takes the degree
 * extents and converts, so the literal here matches the literal in the .cpp.
 */

import '../skeletonmodifier3d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { BONE_AXIS } from '../skeletonmodifier3d/linterParser.js';
import { VECTOR3_AXIS } from '../../../../linter/validators/sharedEnumLabels.js';

/** `LookAtModifier3D::OriginFrom`, hinted "Self,SpecificBone,ExternalNode" at :478. */
const ORIGIN_FROM = { 0: 'Self', 1: 'SpecificBone', 2: 'ExternalNode' } as const;

/** `Tween::TransitionType`, in the hint's own spelling (:487). */
const TRANSITION_TYPE = {
  0: 'Linear',
  1: 'Sine',
  2: 'Quint',
  3: 'Quart',
  4: 'Quad',
  5: 'Expo',
  6: 'Elastic',
  7: 'Cubic',
  8: 'Circ',
  9: 'Bounce',
  10: 'Back',
  11: 'Spring',
} as const;

/** `Tween::EaseType`, in the hint's own spelling (:488). */
const EASE_TYPE = { 0: 'In', 1: 'Out', 2: 'InOut', 3: 'OutIn' } as const;

/** The damping powers, all six hinted "0,1,0.01" over a bare-assigning setter. */
function dampThreshold(name: string, cite: string) {
  return v.float(name, { min: 0, max: 1, hinted: cite });
}

validatorRegistry.registerAll('LookAtModifier3D', {
  // look_at_modifier_3d.cpp:468, Variant::NODE_PATH with PROPERTY_HINT_NODE_TYPE
  // "Node3D". set_target_node (:156-161) restarts the interpolation and assigns;
  // a path to a non-Node3D is cast away at runtime (:537), not refused, so the
  // literal's shape is the only thing checkable here.
  target_node: v.nodePath('target_node'),

  // look_at_modifier_3d.cpp:470, Variant::STRING, PROPERTY_HINT_ENUM_SUGGESTION
  // over the skeleton's bone names: a dropdown that still accepts free text.
  // set_bone_name (:92-98) assigns, then resolves the name against the skeleton.
  bone_name: v.quotedString('bone_name'),

  // look_at_modifier_3d.cpp:471, Variant::INT, PROPERTY_HINT_NONE,
  // PROPERTY_USAGE_NO_EDITOR — which IS storage, so it serialises. -1 is the
  // unset sentinel the setter itself writes: set_bone (:108-111) rewrites
  // anything at or below -1 back to -1 once a skeleton is present, and
  // _validate_bone_names (:78-84) re-runs that setter on the first skeleton
  // update, so a value under -1 cannot survive load as written. The upper end
  // is the live `get_bone_count()`, which no per-property validator can see.
  // `strictInt` because a bone index is discrete: Godot's Variant conversion
  // truncates a decimal rather than keeping it.
  bone: v.strictInt('bone', { min: -1, enforced: 'look_at_modifier_3d.cpp:108-111' }),

  // look_at_modifier_3d.cpp:472, PROPERTY_HINT_ENUM over
  // SkeletonModifier3D::get_hint_bone_axis(), values 0-5. set_forward_axis
  // (:121-124) stores the static_cast unchecked, so the hint governs the
  // inspector only: warning.
  forward_axis: v.enumInt('forward_axis', 0, 5, BONE_AXIS, {
    hinted: 'look_at_modifier_3d.cpp:472',
  }),

  // look_at_modifier_3d.cpp:473. set_primary_rotation_axis (:130-133) likewise
  // assigns the static_cast and only refreshes the configuration warning.
  primary_rotation_axis: v.enumInt('primary_rotation_axis', 0, 2, VECTOR3_AXIS, {
    hinted: 'look_at_modifier_3d.cpp:473',
  }),

  // look_at_modifier_3d.cpp:474 and :475, bare Variant::BOOL with no hint.
  use_secondary_rotation: v.boolean('use_secondary_rotation'),
  relative: v.boolean('relative'),

  // look_at_modifier_3d.cpp:478, PROPERTY_HINT_ENUM "Self,SpecificBone,ExternalNode".
  // set_origin_from (:169-172) assigns and notifies the property list, which is
  // what hides the origin_bone/origin_external_node keys, not a refusal.
  origin_from: v.enumInt('origin_from', 0, 2, ORIGIN_FROM, {
    hinted: 'look_at_modifier_3d.cpp:478',
  }),

  // look_at_modifier_3d.cpp:479, as bone_name; set_origin_bone_name is :178-184.
  origin_bone_name: v.quotedString('origin_bone_name'),

  // look_at_modifier_3d.cpp:480, as bone; set_origin_bone (:194-197) applies the
  // identical rewrite to -1, re-run from _validate_bone_names (:85-89).
  origin_bone: v.strictInt('origin_bone', {
    min: -1,
    enforced: 'look_at_modifier_3d.cpp:194-197',
  }),

  // look_at_modifier_3d.cpp:481, Variant::NODE_PATH; set_origin_external_node
  // (:207-209) is a bare assignment.
  origin_external_node: v.nodePath('origin_external_node'),

  // look_at_modifier_3d.cpp:482, bare Variant::VECTOR3 with no hint;
  // set_origin_offset (:215-217) assigns, so no component is bounded.
  origin_offset: v.vector3('origin_offset'),

  // look_at_modifier_3d.cpp:483, PROPERTY_HINT_RANGE "0,100,0.001,or_greater,
  // suffix:m". `or_greater` opens the MAX end, so only the floor diagnoses, and
  // set_origin_safe_margin (:223-225) assigns it straight through: warning.
  origin_safe_margin: v.float('origin_safe_margin', {
    min: 0,
    hinted: { min: 'look_at_modifier_3d.cpp:483' },
  }),

  // look_at_modifier_3d.cpp:486, PROPERTY_HINT_RANGE "0,10,0.001,or_greater,
  // suffix:s", the same open top end. set_duration (:233-241) assigns and then
  // caches 1/duration, special-casing zero rather than rejecting it, so nothing
  // about the value is refused.
  duration: v.float('duration', {
    min: 0,
    hinted: { min: 'look_at_modifier_3d.cpp:486' },
  }),

  // look_at_modifier_3d.cpp:487 and :488, PROPERTY_HINT_ENUM over Tween's twelve
  // transitions and four eases. Both setters (:247-261) assign the static_cast.
  transition_type: v.enumInt('transition_type', 0, 11, TRANSITION_TYPE, {
    hinted: 'look_at_modifier_3d.cpp:487',
  }),
  ease_type: v.enumInt('ease_type', 0, 3, EASE_TYPE, {
    hinted: 'look_at_modifier_3d.cpp:488',
  }),

  // look_at_modifier_3d.cpp:491 and :492, bare Variant::BOOL. Both setters
  // (:265-281) assign and notify the property list.
  use_angle_limitation: v.boolean('use_angle_limitation'),
  symmetry_limitation: v.boolean('symmetry_limitation'),

  // look_at_modifier_3d.cpp:494, PROPERTY_HINT_RANGE "0,360,0.01,
  // radians_as_degrees": the inspector reads 0-360 DEGREES, the .tscn stores
  // 0..TAU RADIANS. The header defaults it to `Math::TAU` (look_at_modifier_3d.h:75),
  // which lands exactly on the converted ceiling. set_primary_limit_angle
  // (:283-285) assigns.
  primary_limit_angle: v.radians('primary_limit_angle', {
    maxDeg: 360,
    hinted: 'look_at_modifier_3d.cpp:494',
  }),
  primary_damp_threshold: dampThreshold(
    'primary_damp_threshold',
    'look_at_modifier_3d.cpp:495'
  ),

  // look_at_modifier_3d.cpp:497 and :499, "0,180,0.01,radians_as_degrees": the
  // stored bound is 0..PI, the header default for both (look_at_modifier_3d.h:77,
  // :79). Setters at :299-301 and :315-317.
  primary_positive_limit_angle: v.radians('primary_positive_limit_angle', {
    maxDeg: 180,
    hinted: 'look_at_modifier_3d.cpp:497',
  }),
  primary_positive_damp_threshold: dampThreshold(
    'primary_positive_damp_threshold',
    'look_at_modifier_3d.cpp:498'
  ),
  primary_negative_limit_angle: v.radians('primary_negative_limit_angle', {
    maxDeg: 180,
    hinted: 'look_at_modifier_3d.cpp:499',
  }),
  primary_negative_damp_threshold: dampThreshold(
    'primary_negative_damp_threshold',
    'look_at_modifier_3d.cpp:500'
  ),

  // look_at_modifier_3d.cpp:502, the secondary axis's full-turn twin of
  // primary_limit_angle; header default `Math::TAU` (look_at_modifier_3d.h:82),
  // setter :331-333.
  secondary_limit_angle: v.radians('secondary_limit_angle', {
    maxDeg: 360,
    hinted: 'look_at_modifier_3d.cpp:502',
  }),
  secondary_damp_threshold: dampThreshold(
    'secondary_damp_threshold',
    'look_at_modifier_3d.cpp:503'
  ),

  // look_at_modifier_3d.cpp:505 and :507, the secondary axis's half-turn pair;
  // header defaults `Math::PI` (look_at_modifier_3d.h:84, :86), setters at
  // :347-349 and :363-365.
  secondary_positive_limit_angle: v.radians('secondary_positive_limit_angle', {
    maxDeg: 180,
    hinted: 'look_at_modifier_3d.cpp:505',
  }),
  secondary_positive_damp_threshold: dampThreshold(
    'secondary_positive_damp_threshold',
    'look_at_modifier_3d.cpp:506'
  ),
  secondary_negative_limit_angle: v.radians('secondary_negative_limit_angle', {
    maxDeg: 180,
    hinted: 'look_at_modifier_3d.cpp:507',
  }),
  secondary_negative_damp_threshold: dampThreshold(
    'secondary_negative_damp_threshold',
    'look_at_modifier_3d.cpp:508'
  ),
});
