/**
 * AudioListener3D strict validators — format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property — happy, malformed, and any bound — and
 * quote the governing Godot source line beside every numeric bound.
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
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * AudioListener3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 *
 * TWO keys by two different routes. `_bind_methods`
 * (audio_listener_3d.cpp:164-177) ADD_PROPERTYs exactly one, `doppler_tracking`.
 * `current` arrives through the hand-rolled `_get_property_list`/`_set`/`_get`
 * override (cpp:42-72), the same route ChainIK3D uses — invisible to an
 * ADD_PROPERTY grep and absent from the class reference, but serialised all the
 * same. Both belong here.
 */
const KEYS: string[] = ['current', 'doppler_tracking'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys AudioListener3D does NOT declare, each paired with the ancestor that does.
 * Name at least one; Node3D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives AudioListener3D no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
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
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-audio-listener-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // AudioListener3D declares nothing, which is what INHERITED below covers.
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
      // The SAME function, not merely some validator: a shadowing copy on
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
