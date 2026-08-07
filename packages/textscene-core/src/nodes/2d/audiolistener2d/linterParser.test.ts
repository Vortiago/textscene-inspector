/**
 * AudioListener2D strict validators — format checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing.
 *
 * The interesting case for this slice is that a class with an empty class
 * reference and zero ADD_PROPERTY still serialises a property. Reading either
 * of those alone concludes "nothing to validate", and that conclusion held here
 * long enough to be written into an allowlist.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('AudioListener2D', property);
  expect(validator, `no validator registered for AudioListener2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * `current` alone, and it comes from `_get_property_list`
 * (audio_listener_2d.cpp:61-63), not from `_bind_methods` (:110), which binds
 * three methods and no property at all.
 */
const KEYS: string[] = ['current'];

/** Keys AudioListener2D does NOT declare, paired with the ancestor that does. */
const INHERITED: [owner: string, key: string][] = [['Node2D', 'position']];

describe('AudioListener2D strict validators', () => {
  it('registers exactly what AudioListener2D serialises', () => {
    expect(validatorRegistry.getOwnKeys('AudioListener2D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    expectFixtureClean('unit-audio-listener-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    const accepted = validatorRegistry
      .getOwnKeys('AudioListener2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // AudioListener2D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('AudioListener2D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('AudioListener2D')).not.toContain(key);
    }
  });
});

describe('AudioListener2D current', () => {
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
