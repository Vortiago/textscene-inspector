/**
 * FogVolume strict validators, asserted through `validatorRegistry`, not by linting a `.tscn`, so
 * a failure points at the validator and no fixture text needs upkeep. Rule-level behaviour
 * belongs in linter.test.ts. Each property gets happy, malformed and bound cases, with the
 * governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.declarationFor('FogVolume', property);
  expect(validator, `no validator registered for FogVolume.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys FogVolume binds, read from the source. Set this or DECLARES_NOTHING, not both.
 * Leaving both unset is red on purpose: do not delete an assertion to go green.
 */
// fog_volume.cpp:46-48: three ADD_PROPERTY calls in FogVolume::_bind_methods.
const KEYS: string[] = ['size', 'shape', 'material'];
/** True only when the class binds no ADD_PROPERTY, beside the source line that proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys FogVolume does not declare, each paired with the ancestor that does. The malformed-value
 * check below iterates `getOwnKeys`, so on a class with no own keys it passes on an empty set.
 * Resolving a key to the ancestor's own validator function tells "no own properties" from "slice
 * not written", and an empty list is red for the same reason KEYS is.
 */
// `layers` is VisualInstance3D's own (visual_instance_3d.cpp:182) and reaches FogVolume unmodified.
// `sorting_offset`/`sorting_use_aabb_center` carry PROPERTY_USAGE_NONE there, and no FogVolume
// override restores it (see visualinstance3d/linterParser.ts), so FogVolume never serialises them.
const INHERITED: [owner: string, key: string][] = [['VisualInstance3D', 'layers']];

describe('FogVolume strict validators', () => {
  it('registers exactly what FogVolume binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('FogVolume').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned. `fixtureLint`
    // checks it against the whole registry through the barrel. This checks the same file
    // against only what this test imported.
    expectFixtureClean('unit-fog-volume.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow. It is vacuous when the class declares nothing,
    // which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('FogVolume')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key FogVolume inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // FogVolume would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('FogVolume', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('FogVolume')).not.toContain(key);
    }
  });

  describe('size', () => {
    it('accepts the Godot default', () => {
      // doc/classes/FogVolume.xml: default="Vector3(2, 2, 2)".
      expect(check('size', 'Vector3(2, 2, 2)')).toBeNull();
    });

    it('accepts the hinted floor exactly', () => {
      expect(check('size', 'Vector3(0.01, 0.01, 0.01)')).toBeNull();
    });

    it('accepts well above the stated 1024 ceiling, since `or_greater` softens it', () => {
      expect(check('size', 'Vector3(2000, 2000, 2000)')).toBeNull();
    });

    it('warns (not errors) on zero — the setter maxf(0) floor, not the 0.01 hint, is what is enforced', () => {
      expect(check('size', 'Vector3(0, 1, 1)')?.severity).toBe('warning');
    });

    it('rejects a non-Vector3 value', () => {
      const error = check('size', 'not-a-vector');
      expect(error?.code).toBe('INVALID_SIZE_FORMAT');
      expect(error?.severity).toBe('error');
    });

    it('errors on a negative component — the setter clamps it up to 0 (fog_volume.cpp:78)', () => {
      const error = check('size', 'Vector3(-1, 2, 2)');
      expect(error?.code).toBe('INVALID_SIZE_VALUE');
      expect(error?.severity).toBe('error');
    });

    it('warns (not errors) on a component under the 0.01 hint but still non-negative', () => {
      // fog_volume.cpp:46 states the floor as a PROPERTY_HINT_RANGE only; the
      // setter itself never enforces it, so 0.005 loads exactly as written.
      const error = check('size', 'Vector3(0.005, 2, 2)');
      expect(error?.code).toBe('INVALID_SIZE_VALUE');
      expect(error?.severity).toBe('warning');
    });

    it('accepts a non-finite component (`inf`) unaltered — MAX(inf, 0) stays inf', () => {
      expect(check('size', 'Vector3(inf, 2, 2)')).toBeNull();
    });

    it('errors on `-inf` the same way as any other negative component', () => {
      // MAX(-inf, 0) evaluates to 0 (typedefs.h:134's `m_a > m_b ? m_a : m_b`
      // is false for -inf > 0), the same alteration a finite negative gets.
      const error = check('size', 'Vector3(-inf, 2, 2)');
      expect(error?.code).toBe('INVALID_SIZE_VALUE');
      expect(error?.severity).toBe('error');
    });

    it('accepts `nan` silently — every comparison against it is false, same as every other float validator', () => {
      expect(check('size', 'Vector3(nan, 2, 2)')).toBeNull();
    });

    it('records the hinted 0.01 floor as its bound, at the hinted tier', () => {
      // What the hint ledger reads. A hand-rolled validator gets no `ground()`
      // call, so an unrecorded bound counts as unimplemented however many
      // values the function above rejects.
      const validator = validatorRegistry.declarationFor('FogVolume', 'size');
      expect(validator?.bounds).toEqual({ min: 0.01 });
      expect(validator?.tiers).toEqual({ min: 'warning' });
    });
  });

  describe('shape', () => {
    it('accepts every named enum value', () => {
      for (const value of ['0', '1', '2', '3', '4']) {
        expect(check('shape', value)).toBeNull();
      }
    });

    it('rejects a non-integer value', () => {
      const error = check('shape', 'Ellipsoid');
      expect(error?.severity).toBe('error');
    });

    it('warns (not errors) outside the enum — set_shape has no ERR_FAIL_INDEX (fog_volume.cpp:87-93)', () => {
      const error = check('shape', '5');
      expect(error?.severity).toBe('warning');
    });
  });

  describe('material', () => {
    it('accepts a SubResource reference', () => {
      expect(check('material', 'SubResource("FogMaterial_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('material', 'ExtResource("1_mat")')).toBeNull();
    });

    it('rejects a bare identifier', () => {
      const error = check('material', 'FogMaterial_1');
      expect(error?.severity).toBe('error');
    });
  });
});
