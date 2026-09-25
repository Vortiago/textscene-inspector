/**
 * XROrigin3D strict validators, asserted through `validatorRegistry`, not by
 * linting a `.tscn`, so a failure points at the validator and no fixture text needs upkeep.
 * Rule-level behaviour belongs in linter.test.ts. Each property gets happy, malformed and bound
 * cases, with the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('XROrigin3D', property);
  expect(validator, `no validator registered for XROrigin3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys XROrigin3D binds, read from the source. Set this or DECLARES_NOTHING,
 * not both. Leaving both unset is red on purpose: do not delete an assertion to go green.
 */
const KEYS: string[] = ['world_scale', 'current'];
/** False: xr_nodes.cpp:711-719 binds both `world_scale` and `current`. */
const DECLARES_NOTHING = false;

/**
 * Keys XROrigin3D does not declare, each paired with the ancestor that does. The
 * malformed-value check below iterates `getOwnKeys`, so on a class with no own keys it passes on
 * an empty set. Resolving a key to the ancestor's own validator function tells "no own
 * properties" from "slice not written", and an empty list is red for the same reason KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [['Node3D', 'transform']];

describe('XROrigin3D strict validators', () => {
  it('registers exactly what XROrigin3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('XROrigin3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned. `fixtureLint`
    // checks it against the whole registry through the barrel. This checks the same file
    // against only what this test imported.
    expectFixtureClean('unit-xr-origin-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow. It is vacuous when the class declares nothing,
    // which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('XROrigin3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key XROrigin3D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // XROrigin3D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('XROrigin3D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('XROrigin3D')).not.toContain(key);
    }
  });

  describe('world_scale', () => {
    it('accepts the default 1.0', () => {
      expect(check('world_scale', '1.0')).toBeNull();
    });

    it('accepts a mid-range value', () => {
      expect(check('world_scale', '2.5')).toBeNull();
    });

    it('accepts both clamp boundaries', () => {
      expect(check('world_scale', '0.01')).toBeNull();
      expect(check('world_scale', '1000')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('world_scale', 'not-a-number');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('world_scale');
    });

    it('errors below the floor XRServer::set_world_scale clamps to (xr_server.cpp:126-127)', () => {
      const error = check('world_scale', '0.001');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });

    it('errors above the ceiling XRServer::set_world_scale clamps to (xr_server.cpp:128-129)', () => {
      const error = check('world_scale', '2000');
      expect(error).not.toBeNull();
      expect(error?.severity).toBe('error');
    });
  });

  describe('current', () => {
    it('accepts true', () => {
      expect(check('current', 'true')).toBeNull();
    });

    it('accepts the default false', () => {
      expect(check('current', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('current', 'maybe');
      expect(error).not.toBeNull();
      expect(error?.message).toContain('current');
    });
  });
});
