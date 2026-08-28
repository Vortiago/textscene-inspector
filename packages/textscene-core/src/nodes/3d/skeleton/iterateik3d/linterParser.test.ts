/**
 * The IterateIK3D set must reach its subclasses, which is the whole point of
 * the tier. Assert through `findValidator` on a real leaf, not just on the
 * abstract key: a tier that registers but is never imported registers nothing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import type { ParseError } from '../../../../linter/types.js';
import './linterParser.js';

/**
 * Every key IterateIK3D binds, read from its ADD_PROPERTY calls.
 *
 * Set exactly ONE of these two, from the source rather than from expectation:
 * fill KEYS, or set DECLARES_NOTHING when the class binds no ADD_PROPERTY at all
 * (Godot has many: a themed spacer whose whole surface is theme items, an
 * orientation subclass that only fixes an inherited default). Leaving both unset
 * is red on purpose. Do NOT delete an assertion to go green: an empty KEYS
 * against an empty registerAll passes vacuously, which is what the pairing
 * below exists to prevent.
 */
const KEYS: string[] = [
  // iterate_ik_3d.cpp:394-398, the four ADD_PROPERTY calls plus ADD_ARRAY_COUNT.
  'max_iterations',
  'min_distance',
  'angular_delta_limit',
  'deterministic',
  'setting_count',
  // The hand-rolled family from _get_property_list (iterate_ik_3d.cpp:117-125),
  // which appears in no ADD_PROPERTY but is serialised all the same.
  'settings/*',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;
const LEAVES = ['CCDIK3D', 'FABRIK3D', 'JacobianIK3D'] as const;

/** Resolve through the registry exactly as `StrictTscnParser` does. */
function check(key: string, value: string, nodeType = 'IterateIK3D'): ParseError | null {
  const validator = validatorRegistry.findValidator(nodeType, key);
  expect(validator, `no validator resolved for ${nodeType}.${key}`).not.toBeNull();
  return validator!(key, value, 1);
}

describe('IterateIK3D shared validators', () => {
  it('registers exactly what IterateIK3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('IterateIK3D').sort()).toEqual([...KEYS].sort());
  });

  it.each(LEAVES)('delivers every key to %s through the base-walk', (nodeType) => {
    const missing = KEYS.filter((key) => !validatorRegistry.findValidator(nodeType, key));
    expect(missing).toEqual([]);
  });

  it('resolves max_iterations on CCDIK3D, the shape the tier exists for', () => {
    // Named separately from the sweep above so a regression in the base-walk
    // itself reads as "CCDIK3D lost max_iterations", not as an empty diff.
    expect(validatorRegistry.findValidator('CCDIK3D', 'max_iterations')).not.toBeNull();
  });
});

describe('max_iterations', () => {
  it.each(['0', '4', '100', '5000'])('accepts %s', (value) => {
    // "0,100,or_greater" (iterate_ik_3d.cpp:394): `or_greater` opens the MAX
    // end, so 5000 is as legal as the documented default of 4.
    expect(check('max_iterations', value)).toBeNull();
  });

  it('warns below the hinted floor, which the setter does not enforce', () => {
    // set_max_iterations (iterate_ik_3d.cpp:169-171) is a bare assignment, so
    // ADR-0032 makes the hint's floor a warning rather than an error.
    const diagnostic = check('max_iterations', '-1');
    expect(diagnostic?.severity).toBe('warning');
  });

  it('rejects a non-integer as a format problem', () => {
    expect(check('max_iterations', 'four')?.severity).toBe('error');
  });
});

describe('min_distance', () => {
  it.each(['0', '0.001', '1', '250.5'])('accepts %s', (value) => {
    // "0,1,0.001,or_greater" (iterate_ik_3d.cpp:395): the ceiling is open.
    expect(check('min_distance', value)).toBeNull();
  });

  it('accepts inf, a float literal Godot writes and reloads', () => {
    // No is_finite guard in set_min_distance (iterate_ik_3d.cpp:177-179), and
    // inf sits above an open ceiling.
    expect(check('min_distance', 'inf')).toBeNull();
  });

  it('warns below the hinted floor', () => {
    expect(check('min_distance', '-0.5')?.severity).toBe('warning');
  });
});

describe('angular_delta_limit', () => {
  it('accepts the documented default, which is 2 degrees expressed in radians', () => {
    // IterateIK3D.xml default="0.034906585" == deg_to_rad(2), matching
    // iterate_ik_3d.h:255. The proof that the STORED unit is radians.
    expect(check('angular_delta_limit', '0.034906585')).toBeNull();
  });

  it('pins the bound in radians, not in the degrees the hint names', () => {
    // "0,180,0.001,radians_as_degrees" (iterate_ik_3d.cpp:396). The
    // radians_as_degrees flag means the inspector SHOWS 0-180 degrees while
    // the .tscn STORES radians, so the real ceiling is 180 * PI / 180 = PI
    // (3.14159...). 3.0 rad is 171.9 degrees and legal; 3.2 rad is 183.3
    // degrees and past the hint. Bounding on 0-180 instead would accept 3.2
    // and every other nonsense value up to 180 radians.
    expect(check('angular_delta_limit', '3.0')).toBeNull();
    expect(check('angular_delta_limit', '3.2')).not.toBeNull();
  });

  it('accepts pi itself as Godot serialises it', () => {
    // Godot writes 3.1415927; a bare `<= Math.PI` would reject what the engine
    // produced.
    expect(check('angular_delta_limit', '3.1415927')).toBeNull();
  });

  it('warns rather than errors, since the setter assigns straight through', () => {
    // set_angular_delta_limit (iterate_ik_3d.cpp:185-187) is a bare assignment.
    expect(check('angular_delta_limit', '3.2')?.severity).toBe('warning');
  });

  it('accepts a zero-degree float32 round-trip that lands just under the floor', () => {
    // The stored value is float32 and written back in decimal, so 0 degrees can
    // reload a hair negative; a floor at exactly 0 is one epsilon tighter than
    // the hint permits.
    expect(check('angular_delta_limit', '-0.00005')).toBeNull();
  });

  it('warns below zero', () => {
    expect(check('angular_delta_limit', '-0.5')?.severity).toBe('warning');
  });
});

describe('deterministic', () => {
  it.each(['true', 'false'])('accepts %s', (value) => {
    expect(check('deterministic', value)).toBeNull();
  });

  it('rejects a non-boolean', () => {
    expect(check('deterministic', '1')?.severity).toBe('warning');
  });
});

describe('setting_count', () => {
  it.each(['0', '1', '64'])('accepts %s', (value) => {
    expect(check('setting_count', value)).toBeNull();
  });

  it('errors below zero, because the setter refuses it', () => {
    // ADD_ARRAY_COUNT carries PROPERTY_HINT_NONE (class_db.cpp:1492), so there
    // is no hint to fall back on; the floor comes from the ERR_FAIL_COND in the
    // shared template _set_setting_count (ik_modifier_3d.h:98) and is therefore
    // an error, not a warning.
    const diagnostic = check('setting_count', '-1');
    expect(diagnostic?.severity).toBe('error');
  });
});

describe('the settings/ family IterateIK3D adds', () => {
  it('accepts a target_node', () => {
    expect(check('settings/0/target_node', 'NodePath("../Target")')).toBeNull();
  });

  it('rejects a target_node that is not a NodePath', () => {
    expect(check('settings/0/target_node', '"../Target"')?.severity).toBe('error');
  });

  it.each(['0', '1', '2', '3', '4'])('accepts rotation_axis %s', (value) => {
    // PROPERTY_HINT_ENUM "X,Y,Z,All,Custom" (skeleton_modifier_3d.h:87), pushed
    // at iterate_ik_3d.cpp:120.
    expect(check(`settings/0/joints/1/rotation_axis`, value)).toBeNull();
  });

  it('warns on a rotation_axis outside the enum', () => {
    // set_joint_rotation_axis (iterate_ik_3d.cpp:216-227) stores the value
    // unaltered, so the enum hint warns rather than errors.
    expect(check('settings/0/joints/1/rotation_axis', '5')?.severity).toBe('warning');
  });

  it('accepts a rotation_axis_vector and rejects a two-component one', () => {
    expect(check('settings/0/joints/1/rotation_axis_vector', 'Vector3(1, 0, 0)')).toBeNull();
    expect(check('settings/0/joints/1/rotation_axis_vector', 'Vector3(1, 0)')?.severity).toBe(
      'error'
    );
  });

  it('accepts a limitation resource reference', () => {
    expect(
      check('settings/0/joints/1/limitation', 'SubResource("JointLimitation3D_a1b2c")')
    ).toBeNull();
  });

  it.each(['0', '7'])('accepts limitation/right_axis %s', (value) => {
    // PROPERTY_HINT_ENUM "None,+X,-X,+Y,-Y,+Z,-Z,Custom"
    // (skeleton_modifier_3d.h:77), pushed at iterate_ik_3d.cpp:123.
    expect(check('settings/0/joints/1/limitation/right_axis', value)).toBeNull();
  });

  it('warns on a limitation/right_axis outside the enum', () => {
    expect(check('settings/0/joints/1/limitation/right_axis', '8')?.severity).toBe('warning');
  });

  it('accepts a limitation/right_axis_vector', () => {
    expect(check('settings/0/joints/1/limitation/right_axis_vector', 'Vector3(0, 1, 0)')).toBeNull();
  });

  it('accepts a limitation/rotation_offset quaternion', () => {
    expect(
      check('settings/0/joints/1/limitation/rotation_offset', 'Quaternion(0, 0, 0, 1)')
    ).toBeNull();
    expect(
      check('settings/0/joints/1/limitation/rotation_offset', 'Quaternion(0, 0, 1)')?.severity
    ).toBe('error');
  });

  it('errors on a negative setting index, which _set refuses', () => {
    // ERR_FAIL_INDEX_V(which, settings.size(), false) at iterate_ik_3d.cpp:39
    // runs before any leaf is reached, so the write never lands.
    const diagnostic = check('settings/-1/target_node', 'NodePath("../Target")');
    expect(diagnostic?.severity).toBe('error');
  });

  it('errors on a setting index to_int resolves as negative, however it is spelled', () => {
    // `_set` reads the index with a bare `to_int` (iterate_ik_3d.cpp:37) and
    // `_to_int` flips the sign on a `-` seen while the total is still 0
    // (ustring.cpp:2291-2292), so `a-1` is -1 and :39 refuses it.
    expect(check('settings/a-1/joints/0/rotation_axis', '2')?.code).toBe('INVALID_SETTING_INDEX');
    // Both `-` flip, because a `0` digit leaves the total at 0, so this one is
    // setting 1 and the write lands.
    expect(check('settings/-0-1/joints/0/rotation_axis', '2')).toBeNull();
  });

  it('applies the joint leaf under an index to_int resolves', () => {
    // The joint index is read with the same bare `to_int` (:44), so
    // `joints/x/` is joint 0 and the value lands on it.
    expect(check('settings/x/joints/y/rotation_axis', '9')?.severity).toBe('warning');
  });

  it('reaches the family through the base-walk on a real leaf type', () => {
    expect(check('settings/0/joints/1/rotation_axis', '9', 'FABRIK3D')?.severity).toBe('warning');
  });
});

describe('the settings/ keys ChainIK3D owns', () => {
  // This registration shadows ChainIK3D's own `settings/` wildcard for every
  // IterateIK3D descendant, because the base-walk stops at the first matching
  // wildcard. A key IterateIK3D does not add is therefore handed BACK to
  // ChainIK3D rather than reported unknown, and `linterParser.ts` imports that
  // tier so the hand-back has something to reach.
  it.each([
    ['settings/0/root_bone_name', '"Root"'],
    ['settings/0/joint_count', '3'],
    ['settings/0/end_bone/length', '0.5'],
    ['settings/0/end_bone/direction', '2'],
  ])('accepts %s, which ChainIK3D declares and this tier does not', (key, value) => {
    expect(check(key, value)).toBeNull();
  });

  it("propagates ChainIK3D's own diagnostic rather than swallowing it", () => {
    // The half of the hand-back that a lenient "always return null" would fake:
    // ChainIK3D's floor on joint_count must still fire on a CCDIK3D.
    expect(check('settings/0/joint_count', '-1', 'CCDIK3D')).not.toBeNull();
  });

  it("keeps ChainIK3D's root_bone bound alive after the hop", () => {
    // `linter/ikSettingsSeam.test.ts` uses this exact leaf as its canary under
    // the full barrel, where the shadow is real. Pinning it here too means a
    // regression in the hand-back shows up in this scoped run rather than only
    // in the cross-slice guard. root_bone is clamped to -1
    // (chain_ik_3d.cpp:186-188), so -2 is an error and 3 is clean.
    expect(check('settings/0/root_bone', '-2', 'CCDIK3D')?.severity).toBe('error');
    expect(check('settings/0/root_bone', '3', 'CCDIK3D')).toBeNull();
  });
});
