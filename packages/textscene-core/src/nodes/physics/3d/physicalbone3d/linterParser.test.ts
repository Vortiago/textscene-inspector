/**
 * PhysicalBone3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`
 * — PhysicalBone3D has none: it does not override `get_configuration_warnings`
 * (scene/3d/physics/physical_bone_3d.cpp has no such method), so there is no
 * cross-field or contextual check to express.
 *
 * Bounds are quoted from the governing Godot source line beside every case.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('PhysicalBone3D', property);
  expect(validator, `no validator registered for PhysicalBone3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/** Assert a `joint_constraints/...` key warns (never errors) for an out-of-range value. */
function expectRangeWarning(key: string, value: string) {
  const leaf = key.slice(key.lastIndexOf('/') + 1);
  const error = check(key, value);
  expect(error?.code, `${key} = ${value}`).toBe(`INVALID_${leaf.toUpperCase()}_VALUE`);
  expect(error?.severity, `${key} = ${value}`).toBe('warning');
}

/**
 * Pin where a bound sits, not just that one exists: both bounds are accepted and
 * one hint step outside either is rejected, so widening the validator reds a case.
 */
function expectHintedRange(
  key: string,
  bounds: { min: string; belowMin: string; max: string; aboveMax: string }
) {
  expect(check(key, bounds.min), `${key} = ${bounds.min}`).toBeNull();
  expect(check(key, bounds.max), `${key} = ${bounds.max}`).toBeNull();
  expectRangeWarning(key, bounds.belowMin);
  expectRangeWarning(key, bounds.aboveMax);
}

describe('PhysicalBone3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('PhysicalBone3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('PhysicalBone3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('bone_name', () => {
    // physical_bone_3d.cpp:709-712,727-730,740-746 — a virtual StringName
    // property (_get_property_list/_set/_get), never an ADD_PROPERTY; not in
    // doc/classes/PhysicalBone3D.xml either. Bone names come from the parent
    // Skeleton3D at runtime, so only the StringName literal format is checked.
    it('accepts a quoted string', () => {
      expect(check('bone_name', '"thigh.l"')).toBeNull();
    });

    it('accepts a StringName literal', () => {
      expect(check('bone_name', '&"thigh.l"')).toBeNull();
    });

    it('rejects an unquoted value', () => {
      expect(check('bone_name', 'thigh.l')?.code).toBe('INVALID_BONE_NAME_FORMAT');
    });
  });

  describe('joint_type', () => {
    // physical_bone_3d.cpp:891 — PROPERTY_HINT_ENUM "None,PinJoint,ConeJoint,HingeJoint,SliderJoint,6DOFJoint"
    // physical_bone_3d.cpp:913-918 — 6 BIND_ENUM_CONSTANT (JOINT_TYPE_NONE..JOINT_TYPE_6DOF)
    it.each([0, 1, 2, 3, 4, 5])('accepts %i', (n) => {
      expect(check('joint_type', String(n))).toBeNull();
    });

    it('warns past the last constant rather than erroring (set_joint_type has no ERR_FAIL)', () => {
      const error = check('joint_type', '6');
      expect(error?.code).toBe('INVALID_JOINT_TYPE_VALUE');
      expect(error?.severity).toBe('warning');
    });

    it('rejects a non-numeric value', () => {
      expect(check('joint_type', 'Cone')?.code).toBe('INVALID_JOINT_TYPE_FORMAT');
    });
  });

  describe('joint_offset / body_offset', () => {
    // physical_bone_3d.cpp:892,895 — Transform3D, PROPERTY_HINT_NONE (format only)
    it('accepts a Transform3D literal', () => {
      expect(check('joint_offset', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)')).toBeNull();
      expect(check('body_offset', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)')).toBeNull();
    });

    it('rejects a value missing components', () => {
      expect(check('joint_offset', 'Transform3D(1, 0, 0)')?.code).toBe('INVALID_JOINT_OFFSET_FORMAT');
      expect(check('body_offset', 'Transform3D(1, 0, 0)')?.code).toBe('INVALID_BODY_OFFSET_FORMAT');
    });
  });

  describe('joint_rotation', () => {
    // physical_bone_3d.cpp:893 — PROPERTY_HINT_RANGE "-360,360,0.01,or_less,or_greater,radians_as_degrees":
    // or_less AND or_greater both present, so the declared range is a soft
    // editor bound only — any float is valid, including one past 360.
    it('accepts a Vector3 literal', () => {
      expect(check('joint_rotation', 'Vector3(0, 0, 0)')).toBeNull();
    });

    it('accepts a value beyond the soft-bounded editor range', () => {
      expect(check('joint_rotation', 'Vector3(720, -720, 0)')).toBeNull();
    });

    it('rejects a non-Vector3 value', () => {
      expect(check('joint_rotation', '0, 0, 0')?.code).toBe('INVALID_JOINT_ROTATION_FORMAT');
    });
  });

  describe('mass', () => {
    // physical_bone_3d.cpp:897 — PROPERTY_HINT_RANGE "0.01,1000,0.01,or_greater,exp,suffix:kg":
    // or_greater makes 1000 soft; 0.01 has no or_less, so it is a hard min.
    it('accepts the minimum', () => {
      expect(check('mass', '0.01')).toBeNull();
    });

    it('accepts a value past the soft-bounded max', () => {
      expect(check('mass', '5000')).toBeNull();
    });

    it('rejects a value below the hard minimum', () => {
      expect(check('mass', '0')?.code).toBe('INVALID_MASS_VALUE');
    });

    it('rejects a non-numeric value', () => {
      expect(check('mass', 'heavy')?.code).toBe('INVALID_MASS_FORMAT');
    });
  });

  describe('friction / bounce', () => {
    // physical_bone_3d.cpp:898-899 — PROPERTY_HINT_RANGE "0,1,0.01", both bounds hard
    it.each(['friction', 'bounce'])('accepts the bounds of %s', (prop) => {
      expect(check(prop, '0')).toBeNull();
      expect(check(prop, '1')).toBeNull();
    });

    it.each(['friction', 'bounce'])('rejects a value past 1 for %s', (prop) => {
      expect(check(prop, '1.5')?.code).toBe(`INVALID_${prop.toUpperCase()}_VALUE`);
    });

    it.each(['friction', 'bounce'])('rejects a negative value for %s', (prop) => {
      expect(check(prop, '-0.1')?.code).toBe(`INVALID_${prop.toUpperCase()}_VALUE`);
    });
  });

  describe('gravity_scale', () => {
    // physical_bone_3d.cpp:900 — PROPERTY_HINT_RANGE "-8,8,0.001,or_less,or_greater":
    // both or_less and or_greater present — fully unbounded.
    it('accepts a value beyond the soft-bounded range on either side', () => {
      expect(check('gravity_scale', '-50')).toBeNull();
      expect(check('gravity_scale', '50')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('gravity_scale', 'none')?.code).toBe('INVALID_GRAVITY_SCALE_FORMAT');
    });
  });

  describe('custom_integrator / can_sleep', () => {
    it.each(['custom_integrator', 'can_sleep'])('accepts true/false for %s', (prop) => {
      expect(check(prop, 'true')).toBeNull();
      expect(check(prop, 'false')).toBeNull();
    });

    it.each(['custom_integrator', 'can_sleep'])('rejects a non-boolean value for %s', (prop) => {
      expect(check(prop, '1')?.code).toBe(`INVALID_${prop.toUpperCase()}_FORMAT`);
    });
  });

  describe('linear_damp_mode / angular_damp_mode', () => {
    // physical_bone_3d.cpp:902,904 — PROPERTY_HINT_ENUM "Combine,Replace"; 2 BIND_ENUM_CONSTANT
    it.each(['linear_damp_mode', 'angular_damp_mode'])('accepts 0 and 1 for %s', (prop) => {
      expect(check(prop, '0')).toBeNull();
      expect(check(prop, '1')).toBeNull();
    });

    it.each(['linear_damp_mode', 'angular_damp_mode'])(
      'warns past the last constant for %s rather than erroring (bare assignment)',
      (prop) => {
        const error = check(prop, '2');
        expect(error?.code).toBe(`INVALID_${prop.toUpperCase()}_VALUE`);
        expect(error?.severity).toBe('warning');
      }
    );
  });

  describe('linear_damp / angular_damp', () => {
    // physical_bone_3d.cpp:903,905 — PROPERTY_HINT_RANGE "0,100,0.001,or_greater": hard min 0, soft max
    it.each(['linear_damp', 'angular_damp'])('accepts 0 and a value past the soft max for %s', (prop) => {
      expect(check(prop, '0')).toBeNull();
      expect(check(prop, '500')).toBeNull();
    });

    it.each(['linear_damp', 'angular_damp'])('rejects a negative value for %s', (prop) => {
      expect(check(prop, '-1')?.code).toBe(`INVALID_${prop.toUpperCase()}_VALUE`);
    });
  });

  describe('linear_velocity / angular_velocity', () => {
    // physical_bone_3d.cpp:906-907 — Vector3, PROPERTY_HINT_NONE (format only)
    it.each(['linear_velocity', 'angular_velocity'])('accepts a Vector3 literal for %s', (prop) => {
      expect(check(prop, 'Vector3(1, 2, 3)')).toBeNull();
    });

    it.each(['linear_velocity', 'angular_velocity'])('rejects a non-Vector3 value for %s', (prop) => {
      expect(check(prop, '1, 2, 3')?.code).toBe(`INVALID_${prop.toUpperCase()}_FORMAT`);
    });
  });

  // Every JointData subclass's _set stores the value unconditionally (only
  // the PhysicsServer3D forwarding call is gated on the live joint type), so
  // every bound in this describe block is hinted, not enforced: out-of-range
  // warns rather than errors.
  describe('joint_constraints/* — flat leaves (Pin/Cone/Hinge/Slider)', () => {
    // PinJointData::_get_property_list — physical_bone_3d.cpp:160-162. Every
    // hint below steps by 0.01, so ±0.01 is the first value off each end.
    it('pins damping to 0.01-8.0 (physical_bone_3d.cpp:161)', () => {
      expect(check('joint_constraints/damping', '1.0')).toBeNull();
      expectHintedRange('joint_constraints/damping', {
        min: '0.01',
        belowMin: '0',
        max: '8.0',
        aboveMax: '8.01',
      });
    });

    it('pins impulse_clamp to 0.0-64.0 (physical_bone_3d.cpp:162)', () => {
      expectHintedRange('joint_constraints/impulse_clamp', {
        min: '0.0',
        belowMin: '-0.01',
        max: '64.0',
        aboveMax: '64.01',
      });
    });

    // bias is registered by both PinJointData (0.01-0.99, line 160) and
    // ConeJointData (0.01-16.0, line 235): validated against the union, so a
    // value valid under either — including one only Cone allows — passes.
    it('accepts a bias value only valid for Cone, not Pin', () => {
      expect(check('joint_constraints/bias', '5.0')).toBeNull();
    });

    it('pins bias to the union 0.01-16.0 (physical_bone_3d.cpp:160,235)', () => {
      expectHintedRange('joint_constraints/bias', {
        min: '0.01',
        belowMin: '0',
        max: '16.0',
        aboveMax: '16.01',
      });
    });

    // ConeJointData::_get_property_list — physical_bone_3d.cpp:233-237
    it('pins swing_span to -180..180 (physical_bone_3d.cpp:233)', () => {
      expect(check('joint_constraints/swing_span', '19.999992')).toBeNull();
      expectHintedRange('joint_constraints/swing_span', {
        min: '-180',
        belowMin: '-180.01',
        max: '180',
        aboveMax: '180.01',
      });
    });

    it('accepts twist_span past its soft-bounded range (both or_less and or_greater)', () => {
      expect(check('joint_constraints/twist_span', '50000')).toBeNull();
    });

    // Every Cone/Hinge/Slider leaf hinted "0.01,16,0.01" — no or_greater or
    // or_less on any of them, so both ends are real bounds.
    it.each([
      ['softness', 'physical_bone_3d.cpp:236'],
      ['relaxation', 'physical_bone_3d.cpp:237'],
      ['angular_limit_softness', 'physical_bone_3d.cpp:320'],
      ['angular_limit_relaxation', 'physical_bone_3d.cpp:321'],
      ['linear_limit_softness', 'physical_bone_3d.cpp:434'],
      ['linear_limit_restitution', 'physical_bone_3d.cpp:435'],
      ['angular_limit_restitution', 'physical_bone_3d.cpp:441'],
    ])('pins %s to 0.01-16 (%s)', (leaf) => {
      expectHintedRange(`joint_constraints/${leaf}`, {
        min: '0.01',
        belowMin: '0',
        max: '16',
        aboveMax: '16.01',
      });
    });

    // HingeJointData::_get_property_list — physical_bone_3d.cpp:316-321
    it('rejects a non-boolean angular_limit_enabled (physical_bone_3d.cpp:316)', () => {
      expect(check('joint_constraints/angular_limit_enabled', 'true')).toBeNull();
      expect(check('joint_constraints/angular_limit_enabled', 'yes')?.code).toBe(
        'INVALID_ANGULAR_LIMIT_ENABLED_FORMAT'
      );
    });

    // Hinge :317-318 and Slider :438-439 register these with the same bound.
    it.each([
      ['angular_limit_upper', 'physical_bone_3d.cpp:317'],
      ['angular_limit_lower', 'physical_bone_3d.cpp:318'],
    ])('pins %s to -180..180 (%s)', (leaf) => {
      expect(check(`joint_constraints/${leaf}`, '90')).toBeNull();
      expectHintedRange(`joint_constraints/${leaf}`, {
        min: '-180',
        belowMin: '-180.01',
        max: '180',
        aboveMax: '180.01',
      });
    });

    it('pins angular_limit_bias to 0.01-0.99 (physical_bone_3d.cpp:319)', () => {
      expect(check('joint_constraints/angular_limit_bias', '0.3')).toBeNull();
      expectHintedRange('joint_constraints/angular_limit_bias', {
        min: '0.01',
        belowMin: '0',
        max: '0.99',
        aboveMax: '1.0',
      });
      // Sub-step, so a ceiling drifted to 0.999 is caught too.
      expectRangeWarning('joint_constraints/angular_limit_bias', '0.995');
    });

    // SliderJointData::_get_property_list — physical_bone_3d.cpp:432-442
    it('accepts linear_limit_upper/lower unbounded (no PROPERTY_HINT_RANGE at all)', () => {
      expect(check('joint_constraints/linear_limit_upper', '99999')).toBeNull();
      expect(check('joint_constraints/linear_limit_lower', '-99999')).toBeNull();
    });

    // Hinted "0,16.0,0.01": floor 0, not the 0.01 its softness/restitution
    // neighbours carry.
    it.each([
      ['linear_limit_damping', 'physical_bone_3d.cpp:436'],
      ['angular_limit_damping', 'physical_bone_3d.cpp:442'],
    ])('pins %s to 0-16.0 (%s)', (leaf) => {
      expectHintedRange(`joint_constraints/${leaf}`, {
        min: '0',
        belowMin: '-0.01',
        max: '16.0',
        aboveMax: '16.01',
      });
    });
  });

  describe('joint_constraints/<axis>/* — SixDOFJointData per-axis leaves', () => {
    // SixDOFJointData::_get_property_list — physical_bone_3d.cpp:681-706 (x/y/z prefix)
    it.each(['x', 'y', 'z'])('accepts a bool leaf under axis %s', (axis) => {
      expect(check(`joint_constraints/${axis}/linear_limit_enabled`, 'true')).toBeNull();
      expect(check(`joint_constraints/${axis}/linear_spring_enabled`, 'false')).toBeNull();
    });

    it('rejects a non-boolean value for an axis-prefixed bool leaf', () => {
      expect(check('joint_constraints/x/angular_spring_enabled', '1')?.code).toBe(
        'INVALID_ANGULAR_SPRING_ENABLED_FORMAT'
      );
    });

    it('accepts unbounded axis-prefixed floats (no PROPERTY_HINT_RANGE)', () => {
      expect(check('joint_constraints/y/linear_spring_stiffness', '99999')).toBeNull();
      expect(check('joint_constraints/z/erp', '-99999')).toBeNull();
    });

    it('bounds axis-prefixed angular_limit_upper the same as the flat Hinge leaf (physical_bone_3d.cpp:696)', () => {
      expectHintedRange('joint_constraints/x/angular_limit_upper', {
        min: '-180',
        belowMin: '-180.01',
        max: '180',
        aboveMax: '180.01',
      });
    });

    // Leaves SixDOFJointData alone registers, all hinted "0.01,16,0.01" — the
    // axis prefix is the only form Godot ever writes them under.
    it.each([
      ['linear_restitution', 'physical_bone_3d.cpp:693'],
      ['linear_damping', 'physical_bone_3d.cpp:694'],
      ['angular_restitution', 'physical_bone_3d.cpp:699'],
      ['angular_damping', 'physical_bone_3d.cpp:700'],
    ])('pins x/%s to 0.01-16 (%s)', (leaf) => {
      expectHintedRange(`joint_constraints/x/${leaf}`, {
        min: '0.01',
        belowMin: '0',
        max: '16',
        aboveMax: '16.01',
      });
    });
  });

  describe('joint_constraints/* — unknown leaf', () => {
    it('rejects a key whose leaf name is not one Godot ever registers', () => {
      expect(check('joint_constraints/not_a_real_leaf', '1')?.code).toBe(
        'INVALID_JOINT_CONSTRAINTS_KEY'
      );
    });
  });
});
