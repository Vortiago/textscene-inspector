/**
 * AudioListener3D strict validators, asserted through `validatorRegistry`, not by linting a
 * `.tscn`, so a failure points at the validator and no fixture text needs upkeep. Rule-level
 * behaviour belongs in linter.test.ts. Each property gets happy, malformed and bound cases, with
 * the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('AudioListener3D', property);
  expect(validator, `no validator registered for AudioListener3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys AudioListener3D binds, by two routes. `_bind_methods` (audio_listener_3d.cpp:164-177)
 * adds only `doppler_tracking`. `current` arrives through the hand-rolled `_get_property_list`/
 * `_set`/`_get` override (cpp:42-72), as ChainIK3D's keys do: absent from an ADD_PROPERTY grep
 * and the class reference, but serialised.
 */
const KEYS: string[] = ['current', 'doppler_tracking'];
/**
 * True only when the class binds no ADD_PROPERTY, beside the source line that proves it. Set
 * this or KEYS: leaving both unset is red on purpose, so do not delete an assertion to go green.
 */
const DECLARES_NOTHING = false;

/**
 * Keys AudioListener3D does not declare, each paired with the ancestor that does. The
 * malformed-value check below iterates `getOwnKeys`, so on a class with no own keys it passes on
 * an empty set. Resolving a key to the ancestor's own validator function tells "no own
 * properties" from "slice not written", and an empty list is red for the same reason KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [['Node3D', 'position']];

describe('AudioListener3D strict validators', () => {
  it('registers exactly what AudioListener3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('AudioListener3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run, not reasoned. `fixtureLint`
    // checks it against the whole registry through the barrel. This checks the same file
    // against only what this test imported.
    expectFixtureClean('unit-audio-listener-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow. It is vacuous when the class declares nothing,
    // which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('AudioListener3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key AudioListener3D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // AudioListener3D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('AudioListener3D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('AudioListener3D')).not.toContain(key);
    }
  });
});

describe('AudioListener3D current', () => {
  it('accepts both bools (happy)', () => {
    expect(check('current', 'true')).toBeNull();
    expect(check('current', 'false')).toBeNull();
  });

  it('rejects a non-bool as an error (format)', () => {
    const result = check('current', 'yes');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('error');
  });
});

describe('AudioListener3D doppler_tracking', () => {
  it('accepts every enum member (happy)', () => {
    for (const value of ['0', '1', '2']) {
      expect(check('doppler_tracking', value)).toBeNull();
    }
  });

  it('rejects a non-numeric value as an error (format, not range)', () => {
    const result = check('doppler_tracking', 'definitely-not-a-valid-value');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('error');
  });

  it('accepts an out-of-range int as a WARNING only — set_doppler_tracking (audio_listener_3d.cpp:146-158) is a bare assignment behind an equality early-return, never an ERR_FAIL_INDEX, so only the ADD_PROPERTY hint (cpp:172) grounds this, not enforcement (ADR-0032)', () => {
    const result = check('doppler_tracking', '3');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('warning');
  });

  it('warns the same way on the low end (edge, no MAX sentinel in the header so 2 is the only real ceiling)', () => {
    const result = check('doppler_tracking', '-1');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('warning');
  });
});
