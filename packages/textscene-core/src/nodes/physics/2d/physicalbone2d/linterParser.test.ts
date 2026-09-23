/**
 * PhysicalBone2D strict validators, asserted through `validatorRegistry`, not by
 * linting a `.tscn`, so a failure points at the validator and no fixture text needs upkeep.
 * Rule-level behaviour belongs in linter.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('PhysicalBone2D', property);
  expect(validator, `no validator registered for PhysicalBone2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('PhysicalBone2D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('PhysicalBone2D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('PhysicalBone2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  // scene/2d/physics/physical_bone_2d.cpp:282: PROPERTY_HINT_NODE_PATH_VALID_TYPES "Bone2D".
  describe('bone2d_nodepath', () => {
    it('accepts a NodePath literal', () => {
      expect(check('bone2d_nodepath', 'NodePath("../Bone2D")')).toBeNull();
    });

    it('accepts the default empty NodePath', () => {
      expect(check('bone2d_nodepath', 'NodePath("")')).toBeNull();
    });

    // variant.cpp:746-749 lists STRING (not STRING_NAME) as a strict source for NODE_PATH.
    it('accepts the bare string the slot converts and rejects a StringName', () => {
      expect(check('bone2d_nodepath', '"../Bone2D"')).toBeNull();
      const error = check('bone2d_nodepath', '&"../Bone2D"');
      expect(error?.code).toBe('INVALID_BONE2D_NODEPATH_PATH');
    });
  });

  // scene/2d/physics/physical_bone_2d.cpp:283: PROPERTY_HINT_RANGE "-1, 1000, 1". The -1 is the
  // in-memory default (physical_bone_2d.h:47). set_bone2d_index (:228-229) refuses
  // `p_bone_idx < 0`, so the floor is 0. The 1000 ceiling only warns: the index check at
  // :237 needs is_inside_tree().
  describe('bone2d_index', () => {
    it('accepts 0', () => {
      expect(check('bone2d_index', '0')).toBeNull();
    });

    it('accepts a positive index', () => {
      expect(check('bone2d_index', '3')).toBeNull();
    });

    it('accepts the upper bound 1000', () => {
      expect(check('bone2d_index', '1000')).toBeNull();
    });

    it('warns that a non-integer is truncated', () => {
      const error = check('bone2d_index', '2.5');
      expect(error?.code).toBe('INVALID_BONE2D_INDEX_VALUE');
    });

    it('rejects the unassigned sentinel -1 as an error (set_bone2d_index refuses)', () => {
      const error = check('bone2d_index', '-1');
      expect(error?.code).toBe('INVALID_BONE2D_INDEX_VALUE');
      expect(error?.severity).toBe('error');
    });

    it('rejects below 0 as an error', () => {
      const error = check('bone2d_index', '-2');
      expect(error?.code).toBe('INVALID_BONE2D_INDEX_VALUE');
      expect(error?.severity).toBe('error');
    });

    it('warns above the 1000 cap rather than erroring', () => {
      const error = check('bone2d_index', '1001');
      expect(error?.code).toBe('INVALID_BONE2D_INDEX_VALUE');
      expect(error?.severity).toBe('warning');
    });
  });

  // scene/2d/physics/physical_bone_2d.cpp:284.
  describe('auto_configure_joint', () => {
    it('accepts true', () => {
      expect(check('auto_configure_joint', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('auto_configure_joint', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('auto_configure_joint', '1');
      expect(error?.code).toBe('INVALID_AUTO_CONFIGURE_JOINT_FORMAT');
    });
  });

  // scene/2d/physics/physical_bone_2d.cpp:285.
  describe('simulate_physics', () => {
    it('accepts true', () => {
      expect(check('simulate_physics', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('simulate_physics', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('simulate_physics', 'yes');
      expect(error?.code).toBe('INVALID_SIMULATE_PHYSICS_FORMAT');
    });
  });

  // scene/2d/physics/physical_bone_2d.cpp:286.
  describe('follow_bone_when_simulating', () => {
    it('accepts true', () => {
      expect(check('follow_bone_when_simulating', 'true')).toBeNull();
    });

    it('accepts false', () => {
      expect(check('follow_bone_when_simulating', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('follow_bone_when_simulating', '0');
      expect(error?.code).toBe('INVALID_FOLLOW_BONE_WHEN_SIMULATING_FORMAT');
    });
  });
});
