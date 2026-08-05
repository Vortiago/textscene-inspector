/**
 * TwoBoneIK3D strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing. Rule-level behaviour belongs in linter.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('TwoBoneIK3D', property);
  expect(validator, `no validator registered for TwoBoneIK3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys registered directly on TwoBoneIK3D: the `ADD_ARRAY_COUNT` int
 * (two_bone_ik_3d.cpp:506) and the one wildcard covering the whole
 * `settings/<i>/<leaf>` family `_get_property_list` builds
 * (two_bone_ik_3d.cpp:129-160). The family's 14 leaves are patterns behind the
 * wildcard, not registrations of their own, so they are asserted below rather
 * than here.
 */
const KEYS: string[] = ['setting_count', 'settings/*'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/** Every leaf key one setting serialises, in `_get_property_list` order. */
const SETTING_KEYS: string[] = [
  'settings/0/target_node',
  'settings/0/pole_node',
  'settings/0/root_bone_name',
  'settings/0/root_bone',
  'settings/0/middle_bone_name',
  'settings/0/middle_bone',
  'settings/0/pole_direction',
  'settings/0/pole_direction_vector',
  'settings/0/end_bone_name',
  'settings/0/end_bone',
  'settings/0/use_virtual_end',
  'settings/0/extend_end_bone',
  'settings/0/end_bone/direction',
  'settings/0/end_bone/length',
];

describe('TwoBoneIK3D strict validators', () => {
  it('registers exactly what TwoBoneIK3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('TwoBoneIK3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-two-bone-ik-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    const accepted = validatorRegistry
      .getOwnKeys('TwoBoneIK3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('reaches every leaf of the settings family, four-segment keys included', () => {
    // The registry's glued-index matcher rejects `settings/0/end_bone/length`,
    // so a `settings/#/*` registration would leave the two deepest leaves
    // resolving to nothing and silently accepting any value. This is that
    // regression, in the form it would take.
    const unreached = SETTING_KEYS.filter(
      (key) => validatorRegistry.findValidator('TwoBoneIK3D', key) === null
    );
    expect(unreached).toEqual([]);
  });

  it('inherits a base-chain key without re-declaring it', () => {
    // `influence` and `active` are SkeletonModifier3D's
    // (skeleton_modifier_3d.cpp:161), two hops up the chain this slice imports,
    // and must resolve on TwoBoneIK3D through NODE_BASE_TYPES.
    expect(validatorRegistry.findValidator('TwoBoneIK3D', 'influence')).not.toBeNull();
    expect(validatorRegistry.findValidator('TwoBoneIK3D', 'active')).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('TwoBoneIK3D')).not.toContain('influence');
    expect(validatorRegistry.getOwnKeys('TwoBoneIK3D')).not.toContain('active');
    // `mutable_bone_axes` is IKModifier3D's own member (ik_modifier_3d.cpp:64);
    // shadowing it here would duplicate the ancestor's rule.
    expect(validatorRegistry.getOwnKeys('TwoBoneIK3D')).not.toContain('mutable_bone_axes');
  });
});

describe('TwoBoneIK3D.setting_count', () => {
  it('accepts a non-negative count', () => {
    expect(check('setting_count', '0')).toBeNull();
    expect(check('setting_count', '3')).toBeNull();
  });

  it('rejects a negative count as an error', () => {
    // `_set_setting_count` opens with ERR_FAIL_COND(p_count < 0)
    // (ik_modifier_3d.h:98), so the write is refused outright.
    const error = check('setting_count', '-1');
    expect(error?.severity).toBe('error');
  });

  it('rejects a non-integer count', () => {
    expect(check('setting_count', '"two"')).not.toBeNull();
  });
});

describe('TwoBoneIK3D settings/<i>/ key shape', () => {
  it('rejects an unknown leaf name', () => {
    const error = check('settings/0/not_a_leaf', '1');
    expect(error?.code).toBe('INVALID_SETTING_KEY');
  });

  it('rejects an unknown option under end_bone/', () => {
    const error = check('settings/0/end_bone/not_an_option', '1');
    expect(error?.code).toBe('INVALID_SETTING_KEY');
  });

  it('rejects a non-numeric index', () => {
    expect(check('settings/first/target_node', 'NodePath("../Target")')).not.toBeNull();
  });

  it('rejects a negative index on a flat leaf', () => {
    // ERR_FAIL_INDEX_V(which, settings.size(), false), two_bone_ik_3d.cpp:39.
    const error = check('settings/-1/target_node', 'NodePath("../Target")');
    expect(error?.code).toBe('INVALID_SETTING_INDEX');
    expect(error?.severity).toBe('error');
  });

  it('rejects a negative index on a four-segment end_bone key', () => {
    const error = check('settings/-1/end_bone/length', '0.5');
    expect(error?.code).toBe('INVALID_SETTING_INDEX');
    expect(error?.severity).toBe('error');
  });

  it('accepts an index far past the current setting_count, which is the rule\'s job', () => {
    // A per-property validator cannot see a sibling count, so the high end of
    // the index range belongs to linter.ts and must not be guessed at here.
    expect(check('settings/99/use_virtual_end', 'true')).toBeNull();
  });
});

describe('TwoBoneIK3D settings/<i>/ leaves', () => {
  it('takes NodePath literals for the two node references', () => {
    expect(check('settings/0/target_node', 'NodePath("../Target")')).toBeNull();
    expect(check('settings/0/pole_node', 'NodePath("../Pole")')).toBeNull();
    expect(check('settings/0/target_node', '"../Target"')).not.toBeNull();
  });

  it('takes quoted strings for the three bone names', () => {
    expect(check('settings/0/root_bone_name', '"UpperArm"')).toBeNull();
    expect(check('settings/0/middle_bone_name', '"LowerArm"')).toBeNull();
    expect(check('settings/0/end_bone_name', '"Hand"')).toBeNull();
    expect(check('settings/0/root_bone_name', 'UpperArm')).not.toBeNull();
  });

  it('takes any integer for the three bone indices, -1 included', () => {
    // PROPERTY_HINT_NONE (two_bone_ik_3d.cpp:143, 145, 149) and -1 is the
    // "unset" value the getters return, so neither end is assertable.
    expect(check('settings/0/root_bone', '-1')).toBeNull();
    expect(check('settings/0/middle_bone', '0')).toBeNull();
    expect(check('settings/0/end_bone', '250')).toBeNull();
    expect(check('settings/0/end_bone', '2.5')).not.toBeNull();
  });

  it('takes booleans for the two end-bone switches', () => {
    expect(check('settings/0/use_virtual_end', 'false')).toBeNull();
    expect(check('settings/0/extend_end_bone', 'true')).toBeNull();
    expect(check('settings/0/extend_end_bone', '1')).not.toBeNull();
  });

  it('takes a Vector3 for the pole direction vector', () => {
    expect(check('settings/0/pole_direction_vector', 'Vector3(0, 0, 1)')).toBeNull();
    expect(check('settings/0/pole_direction_vector', 'Vector3(0, 1)')).not.toBeNull();
  });

  it('warns on a pole_direction outside the 8-value enum', () => {
    // PROPERTY_HINT_ENUM "None,+X,-X,+Y,-Y,+Z,-Z,Custom"
    // (two_bone_ik_3d.cpp:146); set_pole_direction static_casts and assigns, so
    // the value loads and only the inspector dropdown excludes it.
    expect(check('settings/0/pole_direction', '0')).toBeNull();
    expect(check('settings/0/pole_direction', '7')).toBeNull();
    expect(check('settings/0/pole_direction', '8')?.severity).toBe('warning');
    expect(check('settings/0/pole_direction', '-1')?.severity).toBe('warning');
  });

  it('warns on an end_bone/direction outside the 7-value enum', () => {
    // PROPERTY_HINT_ENUM "+X,-X,+Y,-Y,+Z,-Z,FromParent" (two_bone_ik_3d.cpp:152).
    expect(check('settings/0/end_bone/direction', '0')).toBeNull();
    expect(check('settings/0/end_bone/direction', '6')).toBeNull();
    expect(check('settings/0/end_bone/direction', '7')?.severity).toBe('warning');
  });

  it('warns on a negative end_bone/length and accepts any positive one', () => {
    // PROPERTY_HINT_RANGE "0,1,0.001,or_greater,suffix:m" (two_bone_ik_3d.cpp:153):
    // `or_greater` opens the max end, so 1000 is fine and only the floor bounds.
    expect(check('settings/0/end_bone/length', '0')).toBeNull();
    expect(check('settings/0/end_bone/length', '0.1')).toBeNull();
    expect(check('settings/0/end_bone/length', '1000')).toBeNull();
    expect(check('settings/0/end_bone/length', '-0.5')?.severity).toBe('warning');
  });

  it('accepts inf on end_bone/length, which set_end_bone_length never refuses', () => {
    // `inf` is a legal TSCN float literal (variant_parser.cpp:150-155) and
    // two_bone_ik_3d.cpp:385-396 carries no is_finite guard.
    expect(check('settings/0/end_bone/length', 'inf')).toBeNull();
  });
});
