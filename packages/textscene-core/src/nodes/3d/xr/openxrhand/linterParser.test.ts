/**
 * OpenXRHand strict validators, asserted through `validatorRegistry`, not by linting a
 * `.tscn`, so a failure points at the validator and no fixture text needs upkeep. Rule-level
 * behaviour belongs in linter.test.ts.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('OpenXRHand', property);
  expect(validator, `no validator registered for OpenXRHand.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/** The five ADD_PROPERTY calls in `OpenXRHand::_bind_methods` (openxr_hand.cpp:55-59). */
const KEYS: string[] = ['hand', 'motion_range', 'hand_skeleton', 'skeleton_rig', 'bone_update'];
const DECLARES_NOTHING = false;

describe('OpenXRHand strict validators', () => {
  it('registers exactly what OpenXRHand binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('OpenXRHand').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned. `fixtureLint`
    // checks it against the whole registry through the barrel. This checks the same file
    // against only what this test imported.
    expectFixtureClean('unit-open-xr-hand.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('OpenXRHand')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('hand', () => {
    it('accepts Left (0)', () => {
      expect(check('hand', '0')).toBeNull();
    });

    it('accepts Right (1)', () => {
      expect(check('hand', '1')).toBeNull();
    });

    it('errors past HAND_MAX, which set_hand refuses via ERR_FAIL_INDEX', () => {
      // openxr_hand.cpp:84: ERR_FAIL_INDEX(p_hand, HAND_MAX) returns before the
      // assignment, so the stored value never changes: the enforced tier.
      expect(check('hand', '2')?.severity).toBe('error');
    });

    it('rejects a negative index', () => {
      expect(check('hand', '-1')?.severity).toBe('error');
    });
  });

  describe('motion_range', () => {
    it('accepts Unobstructed (0)', () => {
      expect(check('motion_range', '0')).toBeNull();
    });

    it('accepts Conform to controller (1)', () => {
      expect(check('motion_range', '1')).toBeNull();
    });

    it('errors past MOTION_RANGE_MAX, refused by ERR_FAIL_INDEX', () => {
      // openxr_hand.cpp:100.
      expect(check('motion_range', '2')?.severity).toBe('error');
    });
  });

  describe('hand_skeleton', () => {
    it('accepts a NodePath to a Skeleton3D', () => {
      expect(check('hand_skeleton', 'NodePath("Skeleton3D")')).toBeNull();
    });

    it('accepts the empty NodePath, the documented default', () => {
      expect(check('hand_skeleton', 'NodePath("")')).toBeNull();
    });

    it('accepts a path to a node that is not a Skeleton3D', () => {
      // PROPERTY_HINT_NODE_PATH_VALID_TYPES "Skeleton3D" (openxr_hand.cpp:57)
      // filters the inspector's node picker; set_hand_skeleton (cpp:93-97) is a
      // bare assignment with no type check.
      expect(check('hand_skeleton', 'NodePath("NotASkeleton")')).toBeNull();
    });

    // variant.cpp:746-749 lists STRING (not STRING_NAME) as a strict source for NODE_PATH.
    it('takes the bare string the slot converts and rejects a StringName', () => {
      expect(check('hand_skeleton', '"Skeleton3D"')).toBeNull();
      expect(check('hand_skeleton', '&"Skeleton3D"')).not.toBeNull();
    });
  });

  describe('skeleton_rig', () => {
    it('accepts OpenXR (0)', () => {
      expect(check('skeleton_rig', '0')).toBeNull();
    });

    it('accepts Humanoid (1)', () => {
      expect(check('skeleton_rig', '1')).toBeNull();
    });

    it('errors past SKELETON_RIG_MAX, refused by ERR_FAIL_INDEX', () => {
      // openxr_hand.cpp:136.
      expect(check('skeleton_rig', '2')?.severity).toBe('error');
    });
  });

  describe('bone_update', () => {
    it('accepts Full (0)', () => {
      expect(check('bone_update', '0')).toBeNull();
    });

    it('accepts Rotation Only (1)', () => {
      expect(check('bone_update', '1')).toBeNull();
    });

    it('errors past BONE_UPDATE_MAX, refused by ERR_FAIL_INDEX', () => {
      // openxr_hand.cpp:146.
      expect(check('bone_update', '2')?.severity).toBe('error');
    });
  });

  describe('base-walk inheritance', () => {
    it('resolves a Node3D key (transform) through the ancestor chain', () => {
      expect(validatorRegistry.findValidator('OpenXRHand', 'transform')).not.toBeNull();
    });

    it('does not re-declare that inherited key as its own', () => {
      expect(validatorRegistry.getOwnKeys('OpenXRHand')).not.toContain('transform');
    });
  });
});
