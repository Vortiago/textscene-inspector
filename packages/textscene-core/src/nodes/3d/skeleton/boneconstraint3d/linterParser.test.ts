/**
 * BoneConstraint3D's `settings/<i>/` leaves.
 *
 * The class binds zero `ADD_PROPERTY` and its XML lists no member, so it looked
 * like an abstract base with nothing to validate. It is not: it materialises
 * seven serialised leaves per setting in an UNPREFIXED
 * `BoneConstraint3D::get_property_list` (bone_constraint_3d.cpp:91-115) that
 * every subclass calls before appending its own.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('BoneConstraint3D', property);
  expect(validator, `no validator registered for BoneConstraint3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/** The seven leaves, bone_constraint_3d.cpp:102-108. */
const LEAVES = [
  'amount',
  'apply_bone_name',
  'apply_bone',
  'reference_type',
  'reference_bone_name',
  'reference_bone',
  'reference_node',
];

describe('BoneConstraint3D settings leaves', () => {
  it('registers the family under one wildcard key', () => {
    expect(validatorRegistry.getOwnKeys('BoneConstraint3D')).toEqual(['settings/#/*']);
  });

  it.each(LEAVES)('routes settings/0/%s to a validator', (leaf) => {
    expect(validatorRegistry.findValidator('BoneConstraint3D', `settings/0/${leaf}`)).not.toBeNull();
  });

  describe('amount (float 0-1, hinted)', () => {
    // bone_constraint_3d.cpp:102 hints "0,1,0.001"; set_amount (:164-167)
    // assigns straight through past an ERR_FAIL_INDEX on the setting INDEX, so
    // out of range is the hint's warning rather than an error.
    it.each(['0', '0.5', '1'])('accepts %s', (value) => {
      expect(check('settings/0/amount', value)).toBeNull();
    });

    it.each(['-0.5', '5'])('warns on %s', (value) => {
      expect(check('settings/0/amount', value)?.severity).toBe('warning');
    });

    it('rejects a non-number as a format error', () => {
      expect(check('settings/0/amount', 'half')?.severity).toBe('error');
    });
  });

  describe('reference_type (enum 0-1, hinted)', () => {
    it.each(['0', '1'])('accepts %s', (value) => {
      expect(check(`settings/0/reference_type`, value)).toBeNull();
    });

    it('warns on 2, which the two-value ReferenceType does not name', () => {
      expect(check('settings/0/reference_type', '2')?.severity).toBe('warning');
    });
  });

  describe('the bone indices', () => {
    it.each(['apply_bone', 'reference_bone'])('accepts -1 on %s, the unset default', (leaf) => {
      // bone_constraint_3d.h:48/:53 default both to -1, and the setters only
      // WARN_PRINT an out-of-range index rather than refusing it. Flooring at 0
      // would reject every scene Godot writes for an unassigned bone.
      expect(check(`settings/0/${leaf}`, '-1')).toBeNull();
    });

    it('accepts a large index, since the ceiling is the live bone count', () => {
      expect(check('settings/0/apply_bone', '9999')).toBeNull();
    });

    it('rejects a non-integer', () => {
      expect(check('settings/0/apply_bone', '2.5')?.severity).toBe('error');
    });
  });

  describe('the key shape', () => {
    it('rejects a negative setting index', () => {
      expect(check('settings/-1/amount')?.severity ?? 'error').toBe('error');
    });

    it('rejects an unrecognised leaf', () => {
      expect(check('settings/0/not_a_leaf', '1')).not.toBeNull();
    });

    it('accepts a large setting index, a bound only the sibling count knows', () => {
      expect(check('settings/99/amount', '0.5')).toBeNull();
    });
  });
});
