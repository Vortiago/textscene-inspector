/**
 * SkeletonIK3D strict validators: format checks, and the absence of bounds. Asserted through
 * `validatorRegistry`, so a failure points at the validator, not at scene parsing. Every setter
 * (skeleton_ik_3d.cpp:399 to :476) is a bare assignment, so the tests pin the shape of each key and
 * the values an invented bound would reject.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('SkeletonIK3D', property);
  expect(validator, `no validator registered for SkeletonIK3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The nine `ADD_PROPERTY` calls in `SkeletonIK3D::_bind_methods` (skeleton_ik_3d.cpp:353-361), in
 * source order. `interpolation` (skeleton_ik_3d.cpp:366) is absent: PROPERTY_USAGE_NONE has no
 * STORAGE bit. It is the only member behind `#ifndef DISABLE_DEPRECATED`
 * (skeleton_ik_3d.cpp:363-367), and it forwards to `set_influence` (skeleton_ik_3d.cpp:419).
 */
const KEYS: string[] = [
  'root_bone',
  'tip_bone',
  'target',
  'override_tip_basis',
  'use_magnet',
  'magnet',
  'target_node',
  'min_distance',
  'max_iterations',
];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('SkeletonIK3D strict validators', () => {
  it('registers exactly what SkeletonIK3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('SkeletonIK3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // Runs the fixture's "zero errors and zero warnings" claim against the validators this test
    // imports. `fixtureLint` checks the same file against the whole registry.
    expectFixtureClean('unit-skeleton-ik-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. This loop is generic, and the
    // per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('SkeletonIK3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('leaves the never-serialised interpolation alias unregistered', () => {
    // PROPERTY_USAGE_NONE (skeleton_ik_3d.cpp:366) means no STORAGE bit, so no
    // scene carries the key and validating it would be validating nothing.
    expect(validatorRegistry.getOwnKeys('SkeletonIK3D')).not.toContain('interpolation');
  });

  it('inherits a base-chain key without re-declaring it', () => {
    // `active` and `influence` are SkeletonModifier3D's
    // (skeleton_modifier_3d.cpp:160-161), one hop up the chain this slice
    // imports, and must resolve on SkeletonIK3D through NODE_BASE_TYPES.
    expect(validatorRegistry.findValidator('SkeletonIK3D', 'influence')).not.toBeNull();
    expect(validatorRegistry.findValidator('SkeletonIK3D', 'active')).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('SkeletonIK3D')).not.toContain('influence');
    expect(validatorRegistry.getOwnKeys('SkeletonIK3D')).not.toContain('active');
  });

  it('declares no BOUND at all, on a class whose setters refuse nothing', () => {
    // `boundGrounding` asks only whether a bound is cited. This asserts there is none to cite:
    // every setter (skeleton_ik_3d.cpp:399-476) is a bare assignment. An invented floor such as
    // `v.float('min_distance', { min: 0, enforced: '…' })` passes a classification check and fails
    // this.
    const bounded = validatorRegistry
      .getOwnKeys('SkeletonIK3D')
      .filter((property) => validatorRegistry.declarationFor('SkeletonIK3D', property)?.bounds);
    expect(bounded).toEqual([]);
  });
});

describe('SkeletonIK3D bone names', () => {
  it('takes the &"name" spelling Godot writes, and a plain quoted string', () => {
    // Variant::STRING_NAME (skeleton_ik_3d.cpp:353-354); the XML default is &"".
    expect(check('root_bone', '&"UpperArm"')).toBeNull();
    expect(check('tip_bone', '&"Hand"')).toBeNull();
    expect(check('root_bone', '"UpperArm"')).toBeNull();
  });

  it('accepts the empty name, which is the serialised default', () => {
    expect(check('root_bone', '&""')).toBeNull();
    expect(check('tip_bone', '&""')).toBeNull();
  });

  it('rejects an unquoted name', () => {
    expect(check('root_bone', 'UpperArm')).not.toBeNull();
    expect(check('tip_bone', 'Hand')).not.toBeNull();
  });

  it('accepts a name that is not an enum member', () => {
    // `_validate_property` (skeleton_ik_3d.cpp:307-315) makes these two a PROPERTY_HINT_ENUM only
    // under `is_editor_hint()` (skeleton_ik_3d.cpp:304), over a live Skeleton3D's
    // `get_concatenated_bone_names()`. A linter sees neither, and the property does not serialise
    // under that hint.
    expect(check('root_bone', '&"NoSuchBoneInAnySkeleton"')).toBeNull();
  });
});

describe('SkeletonIK3D.target', () => {
  it('takes a 12-float Transform3D', () => {
    // Variant::TRANSFORM3D, PROPERTY_HINT_NONE (skeleton_ik_3d.cpp:355);
    // set_target_transform (skeleton_ik_3d.cpp:427-430) assigns and reloads the
    // goal, bounding nothing.
    expect(check('target', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)')).toBeNull();
    expect(check('target', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0.5, 1.2, 0.25)')).toBeNull();
  });

  it('rejects a Transform3D with the wrong arity', () => {
    expect(check('target', 'Transform3D(1, 0, 0, 0, 1, 0)')).not.toBeNull();
  });
});

describe('SkeletonIK3D.magnet', () => {
  it('takes any Vector3, sign and magnitude alike', () => {
    // Variant::VECTOR3, PROPERTY_HINT_NONE (skeleton_ik_3d.cpp:358);
    // set_magnet_position (skeleton_ik_3d.cpp:462-464) is a bare assignment.
    expect(check('magnet', 'Vector3(0, 0, 0)')).toBeNull();
    expect(check('magnet', 'Vector3(-3.5, 0.5, 1000)')).toBeNull();
  });

  it('accepts a non-finite component, which no setter here refuses', () => {
    // `inf` and `nan` are legal TSCN float literals (variant_parser.cpp:150-155)
    // and skeleton_ik_3d.cpp:462 carries no is_finite guard.
    expect(check('magnet', 'Vector3(0, -inf, 0)')).toBeNull();
    expect(check('magnet', 'Vector3(nan, 0, 0)')).toBeNull();
  });

  it('rejects a Vector3 with two components', () => {
    expect(check('magnet', 'Vector3(0, 1)')).not.toBeNull();
  });
});

describe('SkeletonIK3D booleans', () => {
  it('takes true and false on both switches', () => {
    // skeleton_ik_3d.cpp:356-357; set_override_tip_basis (:446-448) and
    // set_use_magnet (:454-456) are bare assignments.
    expect(check('override_tip_basis', 'true')).toBeNull();
    expect(check('override_tip_basis', 'false')).toBeNull();
    expect(check('use_magnet', 'true')).toBeNull();
    expect(check('use_magnet', 'false')).toBeNull();
  });

  it('rejects an integer written where a boolean belongs', () => {
    expect(check('use_magnet', '1')).not.toBeNull();
  });
});

describe('SkeletonIK3D.target_node', () => {
  it('takes a NodePath literal', () => {
    // Variant::NODE_PATH (skeleton_ik_3d.cpp:359); set_target_node
    // (skeleton_ik_3d.cpp:436-440) assigns and clears the cached reference.
    expect(check('target_node', 'NodePath("../Target")')).toBeNull();
    expect(check('target_node', 'NodePath("")')).toBeNull();
  });

  // variant.cpp:746-749 lists STRING (not STRING_NAME) as a strict source for NODE_PATH.
  it('takes the bare string the slot converts and rejects a StringName', () => {
    expect(check('target_node', '"../Target"')).toBeNull();
    expect(check('target_node', '&"../Target"')).not.toBeNull();
  });
});

describe('SkeletonIK3D.min_distance', () => {
  it('takes any float, the default included', () => {
    // Variant::FLOAT, PROPERTY_HINT_NONE with only a "suffix:m"
    // (skeleton_ik_3d.cpp:360). set_min_distance (skeleton_ik_3d.cpp:470-472)
    // is a bare assignment, so neither end is bounded.
    expect(check('min_distance', '0.01')).toBeNull();
    expect(check('min_distance', '0')).toBeNull();
    expect(check('min_distance', '250.5')).toBeNull();
  });

  it('accepts a negative distance, which nothing in the class refuses', () => {
    // A floor of 0 would look obvious and be wrong: no guard states it, and
    // `min_distance` is only ever compared against in the solver.
    expect(check('min_distance', '-1')).toBeNull();
  });

  it('accepts inf', () => {
    expect(check('min_distance', 'inf')).toBeNull();
    expect(check('min_distance', 'inf_neg')).toBeNull();
  });

  it('rejects a non-numeric distance', () => {
    expect(check('min_distance', '"near"')).not.toBeNull();
  });
});

describe('SkeletonIK3D.max_iterations', () => {
  it('takes any integer, the default included', () => {
    // Variant::INT, PROPERTY_HINT_NONE (skeleton_ik_3d.cpp:361).
    // set_max_iterations (skeleton_ik_3d.cpp:474-476) is a bare assignment and
    // `reload_chain` copies it onto the task unchanged (skeleton_ik_3d.cpp:528).
    expect(check('max_iterations', '10')).toBeNull();
    expect(check('max_iterations', '0')).toBeNull();
    expect(check('max_iterations', '2048')).toBeNull();
  });

  it('accepts a negative count, which only makes the solver loop zero times', () => {
    expect(check('max_iterations', '-1')).toBeNull();
  });

  it('rejects a fractional count, because an iteration count is discrete', () => {
    expect(check('max_iterations', '10.5')).not.toBeNull();
  });
});
