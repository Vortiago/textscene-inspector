/**
 * BoneTwistDisperser3D strict validators, format, range and tier checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * No radian pair is pinned here because the class has no angle property:
 * `_get_property_list` emits only `"0,1,0.001"` (bone_twist_disperser_3d.cpp:155)
 * and `"0,1,0.001,or_greater,or_less"` (:163) and no `radians_as_degrees`
 * anywhere. The twist is computed from bone poses at process time (:773) and
 * never serialised.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('BoneTwistDisperser3D', property);
  expect(validator, `no validator registered for BoneTwistDisperser3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys BoneTwistDisperser3D registers, which is what `getOwnKeys` returns:
 * two ClassDB properties plus ONE wildcard covering the whole hand-rolled
 * family. The 13 setting leaves and 3 joint leaves live behind the dispatcher
 * and are deliberately not registered individually.
 */
const KEYS: string[] = ['mutable_bone_axes', 'setting_count', 'settings/*'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

describe('BoneTwistDisperser3D strict validators', () => {
  it('registers exactly what BoneTwistDisperser3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('BoneTwistDisperser3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-bone-twist-disperser-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('BoneTwistDisperser3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });
});

describe('BoneTwistDisperser3D inherits rather than re-declares', () => {
  it('resolves influence through the base walk without owning the key', () => {
    // SkeletonModifier3D registers `active` and `influence`; re-declaring
    // either here would shadow the ancestor and duplicate the rule.
    expect(validatorRegistry.findValidator('BoneTwistDisperser3D', 'influence')).not.toBeNull();
    expect(validatorRegistry.findValidator('BoneTwistDisperser3D', 'active')).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('BoneTwistDisperser3D')).not.toContain('influence');
    expect(validatorRegistry.getOwnKeys('BoneTwistDisperser3D')).not.toContain('active');
  });

  it('routes a nested joints key, which the glued-index wildcard could not', () => {
    // `settings/#/*` matches ONE leaf segment, so registering it would leave
    // this key unvalidated. The plain `settings/*` wildcard is what reaches it.
    expect(
      validatorRegistry.findValidator('BoneTwistDisperser3D', 'settings/0/joints/0/twist_amount')
    ).not.toBeNull();
  });
});

describe('mutable_bone_axes', () => {
  // bone_twist_disperser_3d.cpp:560, Variant::BOOL, no hint.
  it('accepts both booleans', () => {
    expect(check('mutable_bone_axes', 'true')).toBeNull();
    expect(check('mutable_bone_axes', 'false')).toBeNull();
  });

  it('rejects a non-boolean', () => {
    expect(check('mutable_bone_axes', 'yes')?.severity).toBe('error');
  });
});

describe('setting_count', () => {
  it('accepts zero and a positive count', () => {
    expect(check('setting_count', '0')).toBeNull();
    expect(check('setting_count', '2')).toBeNull();
  });

  it('errors on a negative count, which ERR_FAIL_COND refuses', () => {
    // bone_twist_disperser_3d.cpp:650, the setter returns before resizing.
    expect(check('setting_count', '-1')?.severity).toBe('error');
  });

  it('warns that a non-integer count is truncated', () => {
    expect(check('setting_count', '1.5')?.severity).toBe('warning');
  });
});

describe('the settings/<i>/ family shape', () => {
  it('rejects an unrecognised leaf, which _set drops', () => {
    // bone_twist_disperser_3d.cpp:74, the final `else { return false; }`.
    expect(check('settings/0/not_a_leaf', 'true')?.code).toBe('INVALID_SETTING_KEY');
  });

  it('rejects a key with no leaf at all', () => {
    expect(check('settings/0', 'true')?.code).toBe('INVALID_SETTING_KEY');
  });

  it('errors on a negative setting index', () => {
    // ERR_FAIL_INDEX_V(which, settings.size(), false), :39.
    const error = check('settings/-1/root_bone', '0');
    expect(error?.code).toBe('INVALID_SETTING_INDEX');
    expect(error?.severity).toBe('error');
  });

  it('errors on a negative joint index', () => {
    // ERR_FAIL_INDEX(p_joint, joints.size()) inside set_joint_twist_amount, :502.
    const error = check('settings/0/joints/-2/twist_amount', '0.5');
    expect(error?.code).toBe('INVALID_JOINT_INDEX');
    expect(error?.severity).toBe('error');
  });

  it('leaves a non-numeric setting index alone, because the write lands', () => {
    // `to_int` skips non-digits (ustring.cpp:2268-2298), so `x` resolves to
    // setting 0 and Godot applies the value. Reporting it is a false positive.
    expect(check('settings/x/root_bone', '0')).toBeNull();
  });

  it('leaves a non-numeric joint index alone for the same reason', () => {
    expect(check('settings/0/joints/x/twist_amount', '0.5')).toBeNull();
  });

  it('still checks the leaf value under a non-numeric index', () => {
    expect(check('settings/x/root_bone', '-9')?.severity).toBe('error');
  });
});

describe('the bone identity leaves', () => {
  it('accepts a quoted bone name and rejects a bare one', () => {
    expect(check('settings/0/root_bone_name', '"UpperArm"')).toBeNull();
    expect(check('settings/0/end_bone_name', '"Hand"')).toBeNull();
    expect(check('settings/0/root_bone_name', 'UpperArm')?.severity).toBe('error');
  });

  it('accepts the -1 unset sentinel and a real index', () => {
    expect(check('settings/0/root_bone', '-1')).toBeNull();
    expect(check('settings/0/root_bone', '0')).toBeNull();
    expect(check('settings/0/end_bone', '-1')).toBeNull();
    expect(check('settings/0/end_bone', '7')).toBeNull();
  });

  it('errors below -1, which the setter rewrites to -1', () => {
    // bone_twist_disperser_3d.cpp:266-268 and :303-305, re-run from
    // _validate_bone_names (:573-574, :579-580) once a skeleton exists.
    expect(check('settings/0/root_bone', '-2')?.severity).toBe('error');
    expect(check('settings/0/end_bone', '-5')?.severity).toBe('error');
  });

  it('warns that a fractional bone index is truncated', () => {
    expect(check('settings/0/root_bone', '3.5')?.severity).toBe('warning');
  });
});

describe('the end-bone tail leaves', () => {
  it('accepts both booleans for extend_end_bone', () => {
    expect(check('settings/0/extend_end_bone', 'true')).toBeNull();
    expect(check('settings/0/extend_end_bone', 'false')).toBeNull();
    expect(check('settings/0/extend_end_bone', '1')?.severity).toBe('error');
  });

  it('accepts every BoneDirection constant', () => {
    for (const value of ['0', '1', '2', '3', '4', '5', '6']) {
      expect(check('settings/0/end_bone_direction', value), value).toBeNull();
    }
  });

  it('warns rather than errors outside the enum hint', () => {
    // :149 is PROPERTY_HINT_ENUM; set_end_bone_direction (:333-336) stores the
    // static_cast unchecked, so the value loads and only the dropdown refuses it.
    expect(check('settings/0/end_bone_direction', '7')?.severity).toBe('warning');
    expect(check('settings/0/end_bone_direction', '-1')?.severity).toBe('warning');
  });

  it('resolves through the one dispatcher that owns the sheet Accepts column', () => {
    // Every family key resolves to the same registered wildcard, so the sheet
    // gets one row for `settings/*` and the leaf descriptions sit behind it.
    const validator = validatorRegistry.findValidator(
      'BoneTwistDisperser3D',
      'settings/0/end_bone_direction'
    );
    expect(validator?.accepts).toBe('settings/<i>/<leaf> and settings/<i>/joints/<j>/<leaf>');
  });
});

describe('the twist-source leaves', () => {
  it('accepts both booleans for twist_from_rest', () => {
    expect(check('settings/0/twist_from_rest', 'true')).toBeNull();
    expect(check('settings/0/twist_from_rest', 'false')).toBeNull();
  });

  it('accepts a Quaternion literal, normalised or not', () => {
    // The setter (:354-357) assigns; normalisation happens at process time (:770).
    expect(check('settings/0/twist_from', 'Quaternion(0, 0, 0, 1)')).toBeNull();
    expect(check('settings/0/twist_from', 'Quaternion(0, 0.7071068, 0, 0.7071068)')).toBeNull();
    expect(check('settings/0/twist_from', 'Quaternion(0, 2, 0, 5)')).toBeNull();
  });

  it('rejects a quaternion of the wrong arity', () => {
    expect(check('settings/0/twist_from', 'Quaternion(0, 0, 1)')?.severity).toBe('error');
  });
});

describe('the disperse-mode leaves', () => {
  it('accepts every DisperseMode constant', () => {
    expect(check('settings/0/disperse_mode', '0')).toBeNull();
    expect(check('settings/0/disperse_mode', '1')).toBeNull();
    expect(check('settings/0/disperse_mode', '2')).toBeNull();
  });

  it('warns rather than errors outside the enum hint', () => {
    // :154 is PROPERTY_HINT_ENUM "Even,Weighted,Custom"; set_disperse_mode
    // (:411-415) stores the static_cast unchecked.
    expect(check('settings/0/disperse_mode', '3')?.severity).toBe('warning');
  });

  it('accepts weight_position across the closed hint range', () => {
    expect(check('settings/0/weight_position', '0')).toBeNull();
    expect(check('settings/0/weight_position', '0.5')).toBeNull();
    expect(check('settings/0/weight_position', '1')).toBeNull();
  });

  it('warns at BOTH ends of weight_position, since neither is open', () => {
    // :155 is PROPERTY_HINT_RANGE "0,1,0.001" with no or_greater and no
    // or_less; set_weight_position (:422-425) assigns straight through.
    expect(check('settings/0/weight_position', '-0.5')?.severity).toBe('warning');
    expect(check('settings/0/weight_position', '1.5')?.severity).toBe('warning');
  });

  it('rejects a non-numeric weight_position as an error', () => {
    expect(check('settings/0/weight_position', 'half')?.severity).toBe('error');
  });
});

describe('damping_curve', () => {
  it('accepts the bare null Godot writes for an unset Ref', () => {
    // The leaf is outside ClassDB, so the packer cannot recognise a default and
    // writes it on every Custom-mode save (property_utils.cpp:182-198,
    // packed_scene.cpp:982); VariantWriter stores `null` for a null OBJECT
    // (variant_parser.cpp:2184-2185).
    expect(check('settings/0/damping_curve', 'null')).toBeNull();
  });

  it('accepts either resource reference form', () => {
    expect(check('settings/0/damping_curve', 'ExtResource("1_abc")')).toBeNull();
    expect(check('settings/0/damping_curve', 'SubResource("Curve_x1y2z")')).toBeNull();
  });

  it('rejects a token neither writer branch produces', () => {
    expect(check('settings/0/damping_curve', '"res://curve.tres"')?.severity).toBe('error');
  });
});

describe('joint_count', () => {
  it('accepts zero and a positive count', () => {
    expect(check('settings/0/joint_count', '0')).toBeNull();
    expect(check('settings/0/joint_count', '3')).toBeNull();
  });

  it('errors on a negative count, which ERR_FAIL_COND refuses', () => {
    // set_joint_count, bone_twist_disperser_3d.cpp:487.
    expect(check('settings/0/joint_count', '-1')?.severity).toBe('error');
  });

  it('warns that a fractional count is truncated', () => {
    expect(check('settings/0/joint_count', '2.5')?.severity).toBe('warning');
  });
});

describe('joints/<j>/twist_amount', () => {
  it('accepts a value inside the hint range', () => {
    expect(check('settings/0/joints/0/twist_amount', '0.25')).toBeNull();
    expect(check('settings/1/joints/2/twist_amount', '1')).toBeNull();
  });

  it('accepts values past BOTH ends, because both are open', () => {
    // :163 is "0,1,0.001,or_greater,or_less": `or_greater` opens the max end
    // and `or_less` the min end, so the hint states no reportable bound at all
    // (ADR-0032), and set_joint_twist_amount (:499-504) assigns straight
    // through. Reporting either end would be an invented bound.
    expect(check('settings/0/joints/0/twist_amount', '5')).toBeNull();
    expect(check('settings/0/joints/0/twist_amount', '-5')).toBeNull();
  });

  it('accepts the non-finite float literals Godot writes and reloads', () => {
    // variant_parser.cpp:150-155; no setter here opens with
    // ERR_FAIL_COND(!is_finite(...)), so neither is refused.
    expect(check('settings/0/joints/0/twist_amount', 'inf')).toBeNull();
    expect(check('settings/0/joints/0/twist_amount', 'nan')).toBeNull();
  });

  it('still rejects a non-numeric amount', () => {
    expect(check('settings/0/joints/0/twist_amount', 'lots')?.severity).toBe('error');
  });

  it('rejects an unrecognised joint leaf', () => {
    expect(check('settings/0/joints/0/nonsense', '1')?.code).toBe('INVALID_SETTING_KEY');
  });
});

describe('the derived read-only leaves', () => {
  // Each carries no PROPERTY_USAGE_STORAGE, so the packer never writes it
  // (packed_scene.cpp:865), and _set has no branch for it, so a hand-written
  // value is dropped in silence (:74 for the setting leaf, :71 for the joints).
  it('refuses every value of reference_bone_name', () => {
    const error = check('settings/0/reference_bone_name', '"LowerArm"');
    expect(error?.code).toBe('INVALID_SETTING_READONLY');
    expect(error?.severity).toBe('error');
  });

  it('refuses every value of the joint bone pair', () => {
    expect(check('settings/0/joints/0/bone_name', '"UpperArm"')?.code).toBe(
      'INVALID_SETTING_READONLY'
    );
    expect(check('settings/0/joints/0/bone', '0')?.code).toBe('INVALID_SETTING_READONLY');
  });
});

describe('grounding metadata', () => {
  it('grounds the dispatcher on the index guard the class itself carries', () => {
    const validator = validatorRegistry.findValidator('BoneTwistDisperser3D', 'settings/*');
    expect(validator?.grounding).toEqual({
      kind: 'enforced',
      cite: 'bone_twist_disperser_3d.cpp:39',
    });
  });

  it('classifies every leaf behind the dispatcher', () => {
    // `boundGrounding` recurses through `.leaves`; a leaf declaring neither tag
    // would be counted as un-audited there, so catch it in the slice instead.
    const validator = validatorRegistry.findValidator('BoneTwistDisperser3D', 'settings/*');
    const unclassified: string[] = [];
    const visit = (leaf: NonNullable<typeof validator>, label: string) => {
      if (!leaf.formatOnly && !leaf.grounding) unclassified.push(label);
      leaf.leaves?.forEach((inner, index) => visit(inner, `${label}[${index}]`));
    };
    validator!.leaves?.forEach((leaf, index) => visit(leaf, `settings/*[${index}]`));
    expect(unclassified).toEqual([]);
  });
});
