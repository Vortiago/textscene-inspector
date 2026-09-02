/**
 * LookAtModifier3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Every numeric bound below quotes the governing Godot source line. The six
 * angle properties are the interesting ones: their hints read in DEGREES and
 * the `.tscn` stores RADIANS, so each carries an explicit conversion case that
 * a degree-unit bound would pass and a radian-unit bound would not.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.declarationFor('LookAtModifier3D', property);
  expect(validator, `no validator registered for LookAtModifier3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * LookAtModifier3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 *
 * All thirty come from the `ADD_PROPERTY` block at look_at_modifier_3d.cpp:468-508,
 * the class's only route into a `.tscn`: it declares no `_set`/`_get`, no
 * `get_property_list`, no `PropertyListHelper` and no `ADD_ARRAY_COUNT`.
 */
const KEYS: string[] = [
  'target_node',
  'bone_name',
  'bone',
  'forward_axis',
  'primary_rotation_axis',
  'use_secondary_rotation',
  'relative',
  'origin_from',
  'origin_bone_name',
  'origin_bone',
  'origin_external_node',
  'origin_offset',
  'origin_safe_margin',
  'duration',
  'transition_type',
  'ease_type',
  'use_angle_limitation',
  'symmetry_limitation',
  'primary_limit_angle',
  'primary_damp_threshold',
  'primary_positive_limit_angle',
  'primary_positive_damp_threshold',
  'primary_negative_limit_angle',
  'primary_negative_damp_threshold',
  'secondary_limit_angle',
  'secondary_damp_threshold',
  'secondary_positive_limit_angle',
  'secondary_positive_damp_threshold',
  'secondary_negative_limit_angle',
  'secondary_negative_damp_threshold',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/** The four angle properties Godot hints `"0,180,0.01,radians_as_degrees"`. */
const HALF_TURN_ANGLES = [
  'primary_positive_limit_angle',
  'primary_negative_limit_angle',
  'secondary_positive_limit_angle',
  'secondary_negative_limit_angle',
];

/** The two angle properties Godot hints `"0,360,0.01,radians_as_degrees"`. */
const FULL_TURN_ANGLES = ['primary_limit_angle', 'secondary_limit_angle'];

/** The six `"0,1,0.01"` damping powers. */
const DAMP_THRESHOLDS = [
  'primary_damp_threshold',
  'primary_positive_damp_threshold',
  'primary_negative_damp_threshold',
  'secondary_damp_threshold',
  'secondary_positive_damp_threshold',
  'secondary_negative_damp_threshold',
];

describe('LookAtModifier3D strict validators', () => {
  it('registers exactly what LookAtModifier3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('LookAtModifier3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-look-at-modifier-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('LookAtModifier3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('reaches SkeletonModifier3D through the base-walk instead of re-declaring it', () => {
    // `influence` and `active` belong to SkeletonModifier3D. Re-declaring
    // either here would shadow the ancestor's and duplicate its rule, so the
    // check is two-sided: resolvable from this type, absent from its own keys.
    expect(validatorRegistry.findValidator('LookAtModifier3D', 'influence')).not.toBeNull();
    expect(validatorRegistry.findValidator('LookAtModifier3D', 'active')).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('LookAtModifier3D')).not.toContain('influence');
    expect(validatorRegistry.getOwnKeys('LookAtModifier3D')).not.toContain('active');
    // The inherited bound still behaves as SkeletonModifier3D declared it.
    expect(check('influence', '1.0')).toBeNull();
    expect(check('influence', '2.0')).not.toBeNull();
  });

  describe('node paths', () => {
    it.each(['target_node', 'origin_external_node'])('accepts a NodePath on %s', (property) => {
      expect(check(property, 'NodePath("../Target")')).toBeNull();
      expect(check(property, 'NodePath("")')).toBeNull();
    });

    // variant.cpp:746-749 lists STRING (not STRING_NAME) as a strict source for NODE_PATH.
    it.each(['target_node', 'origin_external_node'])('rejects a StringName on %s', (property) => {
      expect(check(property, '"../Target"')).toBeNull();
      expect(check(property, '&"../Target"')?.code).toBe(
        `INVALID_${property.toUpperCase()}_PATH`
      );
    });
  });

  describe('bone names', () => {
    it.each(['bone_name', 'origin_bone_name'])('accepts any quoted string on %s', (property) => {
      // look_at_modifier_3d.cpp:470 and :479 hint PROPERTY_HINT_ENUM_SUGGESTION:
      // a dropdown of the skeleton's bone names that still accepts free text,
      // so the set of names constrains nothing.
      expect(check(property, '"Head"')).toBeNull();
      expect(check(property, '""')).toBeNull();
      expect(check(property, '"a name Godot never suggested"')).toBeNull();
    });

    it.each(['bone_name', 'origin_bone_name'])('rejects an unquoted value on %s', (property) => {
      expect(check(property, 'Head')).not.toBeNull();
    });
  });

  describe('bone indices', () => {
    it.each(['bone', 'origin_bone'])('accepts a real index and the -1 sentinel on %s', (property) => {
      expect(check(property, '-1')).toBeNull();
      expect(check(property, '0')).toBeNull();
      expect(check(property, '42')).toBeNull();
    });

    it.each(['bone', 'origin_bone'])('errors below the -1 sentinel on %s', (property) => {
      // set_bone (look_at_modifier_3d.cpp:108-111) and set_origin_bone (:194-197)
      // rewrite anything at or below -1 back to -1 once a skeleton is present,
      // so the value does not survive as written: enforced, an error.
      const error = check(property, '-2');
      expect(error?.severity).toBe('error');
    });

    it.each(['bone', 'origin_bone'])(
      'warns that a fractional index on %s is truncated',
      (property) => {
        expect(check(property, '3.5')?.message).toContain('integer slot');
      }
    );

    it.each(['bone', 'origin_bone'])('leaves the upper end open on %s', (property) => {
      // The real ceiling is the live `get_bone_count()`, which no per-property
      // validator can see (look_at_modifier_3d.cpp:108).
      expect(check(property, '100000')).toBeNull();
    });
  });

  describe('enums', () => {
    it('accepts every BoneAxis on forward_axis and warns past it', () => {
      // look_at_modifier_3d.cpp:472, PROPERTY_HINT_ENUM over
      // SkeletonModifier3D::get_hint_bone_axis() "+X,-X,+Y,-Y,+Z,-Z"
      // (skeleton_modifier_3d.h:52), so 0-5. set_forward_axis (:121-124)
      // assigns the static_cast unchecked: hinted, a warning.
      for (const value of ['0', '1', '2', '3', '4', '5']) {
        expect(check('forward_axis', value)).toBeNull();
      }
      expect(check('forward_axis', '6')?.severity).toBe('warning');
      expect(check('forward_axis', '-1')?.severity).toBe('warning');
    });

    it('accepts the three Vector3 axes on primary_rotation_axis', () => {
      // look_at_modifier_3d.cpp:473, PROPERTY_HINT_ENUM "X,Y,Z".
      for (const value of ['0', '1', '2']) {
        expect(check('primary_rotation_axis', value)).toBeNull();
      }
      expect(check('primary_rotation_axis', '3')?.severity).toBe('warning');
    });

    it('accepts the three OriginFrom constants', () => {
      // look_at_modifier_3d.cpp:478, PROPERTY_HINT_ENUM "Self,SpecificBone,ExternalNode".
      for (const value of ['0', '1', '2']) {
        expect(check('origin_from', value)).toBeNull();
      }
      expect(check('origin_from', '3')?.severity).toBe('warning');
    });

    it('accepts the twelve Tween transition types', () => {
      // look_at_modifier_3d.cpp:487, PROPERTY_HINT_ENUM
      // "Linear,Sine,Quint,Quart,Quad,Expo,Elastic,Cubic,Circ,Bounce,Back,Spring".
      for (let value = 0; value <= 11; value++) {
        expect(check('transition_type', String(value))).toBeNull();
      }
      expect(check('transition_type', '12')?.severity).toBe('warning');
    });

    it('accepts the four Tween ease types', () => {
      // look_at_modifier_3d.cpp:488, PROPERTY_HINT_ENUM "In,Out,InOut,OutIn".
      for (const value of ['0', '1', '2', '3']) {
        expect(check('ease_type', value)).toBeNull();
      }
      expect(check('ease_type', '4')?.severity).toBe('warning');
    });
  });

  describe('booleans', () => {
    it.each(['use_secondary_rotation', 'relative', 'use_angle_limitation', 'symmetry_limitation'])(
      'accepts only true or false on %s',
      (property) => {
        expect(check(property, 'true')).toBeNull();
        expect(check(property, 'false')).toBeNull();
        expect(check(property, '1')).not.toBeNull();
      }
    );
  });

  describe('origin_offset', () => {
    it('accepts a Vector3 and rejects anything else', () => {
      // look_at_modifier_3d.cpp:482, a bare Variant::VECTOR3 with no hint;
      // set_origin_offset (:215-217) assigns, so no component is bounded.
      expect(check('origin_offset', 'Vector3(0, 0, 0)')).toBeNull();
      expect(check('origin_offset', 'Vector3(-1000.5, 2, 3e4)')).toBeNull();
      expect(check('origin_offset', 'Vector2(0, 0)')).not.toBeNull();
    });
  });

  describe('open-ended ranges', () => {
    it.each([
      ['origin_safe_margin', 'look_at_modifier_3d.cpp:483'],
      ['duration', 'look_at_modifier_3d.cpp:486'],
    ])('%s warns below zero and leaves the top open', (property) => {
      // Both hints carry `or_greater`, which opens the max end, so only the
      // floor produces a diagnostic and it is the hint's, not a setter's.
      expect(check(property, '0')).toBeNull();
      expect(check(property, '0.1')).toBeNull();
      expect(check(property, '5000')).toBeNull();
      expect(check(property, '-0.001')?.severity).toBe('warning');
    });

    it('records where each open-ended bound comes from', () => {
      for (const property of ['origin_safe_margin', 'duration']) {
        const validator = validatorRegistry.declarationFor('LookAtModifier3D', property);
        expect(validator?.grounding?.kind).toBe('hinted');
        expect(validator?.grounding?.cite).toMatch(/look_at_modifier_3d\.cpp:\d+/);
      }
    });
  });

  describe('damp thresholds', () => {
    it.each(DAMP_THRESHOLDS)('%s accepts 0 to 1 and warns outside it', (property) => {
      // look_at_modifier_3d.cpp:495, :498, :500, :503, :506 and :508 all hint
      // "0,1,0.01" with no `or_greater`; every setter (:291-377) assigns.
      expect(check(property, '0')).toBeNull();
      expect(check(property, '0.5')).toBeNull();
      expect(check(property, '1')).toBeNull();
      expect(check(property, '1.5')?.severity).toBe('warning');
      expect(check(property, '-0.5')?.severity).toBe('warning');
    });
  });

  describe('radians_as_degrees angles', () => {
    it.each(HALF_TURN_ANGLES)('%s bounds RADIANS, not the hint\'s degrees', (property) => {
      // Hint "0,180,0.01,radians_as_degrees" (look_at_modifier_3d.cpp:497, :499,
      // :505, :507): the inspector shows 0 to 180 DEGREES, the .tscn stores
      // RADIANS, so the stored ceiling is 180 * PI / 180 = PI ≈ 3.14159265.
      //
      // 3.5 is the discriminating value: comfortably inside the degree number
      // 180 and outside the radian ceiling PI. A bound written on the degree
      // numbers accepts it, which is the whole failure mode this pins.
      expect(check(property, '3.5')?.severity).toBe('warning');
      expect(check(property, '3.5')?.message).toContain('radians');
      expect(check(property, '180')).not.toBeNull();
    });

    it.each(HALF_TURN_ANGLES)('%s accepts the PI default Godot itself writes', (property) => {
      // look_at_modifier_3d.h:77-85 default all four to `Math::PI`, which
      // serialises as the float32 literal 3.1415927 — just OVER PI in double
      // precision, so the epsilon in `v.radians` is what keeps Godot's own
      // output legal.
      expect(check(property, '3.1415927')).toBeNull();
      expect(check(property, '0')).toBeNull();
      expect(check(property, '1.5707963')).toBeNull(); // 90 degrees
      expect(check(property, '-0.5')?.severity).toBe('warning');
    });

    it.each(FULL_TURN_ANGLES)('%s bounds a full turn in radians', (property) => {
      // Hint "0,360,0.01,radians_as_degrees" (look_at_modifier_3d.cpp:494, :502):
      // the stored ceiling is 360 * PI / 180 = TAU ≈ 6.28318531.
      //
      // 7 is the discriminating value: inside the degree number 360, outside
      // the radian ceiling TAU.
      expect(check(property, '7')?.severity).toBe('warning');
      expect(check(property, '7')?.message).toContain('radians');
      expect(check(property, '360')).not.toBeNull();
    });

    it.each(FULL_TURN_ANGLES)('%s accepts the TAU default Godot itself writes', (property) => {
      // look_at_modifier_3d.h:75 and :82 default both to `Math::TAU`, whose
      // float32 spelling is 6.2831855.
      expect(check(property, '6.2831855')).toBeNull();
      expect(check(property, '0')).toBeNull();
      expect(check(property, '3.1415927')).toBeNull(); // 180 degrees
      expect(check(property, '-0.5')?.severity).toBe('warning');
    });

    it.each([...HALF_TURN_ANGLES, ...FULL_TURN_ANGLES])(
      '%s accepts a zero-degree round-trip that lands just under the floor',
      (property) => {
        // Every one of these is a float32 the engine writes back in decimal, so
        // a value the editor set to 0 degrees reloads a hair negative. A floor
        // at exactly 0 is one epsilon tighter than the hint permits.
        expect(check(property, '-0.00005')).toBeNull();
      }
    );

    it('states the radian bound and the degree hint side by side', () => {
      // The message has to name both units, or a reader cannot tell which one
      // the number in the scene is in.
      const half = check('primary_positive_limit_angle', '3.5');
      expect(half?.message).toContain('3.1417');
      expect(half?.message).toContain('0 to 180 degrees');

      const full = check('primary_limit_angle', '7');
      expect(full?.message).toContain('6.2833');
      expect(full?.message).toContain('0 to 360 degrees');
    });

    it('grounds every angle bound in the ADD_PROPERTY that states it', () => {
      for (const property of [...HALF_TURN_ANGLES, ...FULL_TURN_ANGLES]) {
        const validator = validatorRegistry.declarationFor('LookAtModifier3D', property);
        // Hinted, never enforced: every angle setter (look_at_modifier_3d.cpp:283-377)
        // is a bare assignment, so the hint governs the inspector alone.
        expect(validator?.grounding?.kind, property).toBe('hinted');
        expect(validator?.grounding?.cite, property).toMatch(/look_at_modifier_3d\.cpp:\d+/);
      }
    });
  });

  describe('non-finite floats', () => {
    it('treats inf as out of a closed range and lets an open end through', () => {
      // `inf` is a legal TSCN float literal (variant_parser.cpp:150-155) and no
      // setter here guards `is_finite`, so it is never a format error. A closed
      // hint still puts it outside the inspector's range, which is a warning;
      // `duration`'s `or_greater` end leaves it alone.
      expect(check('primary_limit_angle', 'inf')?.severity).toBe('warning');
      expect(check('duration', 'inf')).toBeNull();
      expect(check('duration', '-inf')?.severity).toBe('warning');
    });
  });
});
