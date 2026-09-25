/**
 * DirectionalLight2D strict validators: format and range checks, asserted through
 * `validatorRegistry` so a failure points at the validator, not at scene parsing.
 * Each numeric bound quotes its governing Godot source line.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('DirectionalLight2D', property);
  expect(validator, `no validator registered for DirectionalLight2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys DirectionalLight2D binds, read from the source. Set this or
 * DECLARES_NOTHING: leaving both unset fails on purpose.
 */
const KEYS: string[] = ['height', 'max_distance'];
/** True only when the class binds no ADD_PROPERTY, with the source line that proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys DirectionalLight2D does not declare, each paired with the ancestor that
 * does. The malformed-value check iterates `getOwnKeys`, so it passes vacuously on
 * a class that declares nothing. Resolving a key to the ancestor's own validator
 * tells "declares nothing" apart from "not written yet".
 */
const INHERITED: [owner: string, key: string][] = [
  ['Light2D', 'enabled'],
  ['Light2D', 'editor_only'],
  ['Light2D', 'color'],
  ['Light2D', 'energy'],
  ['Light2D', 'blend_mode'],
  ['Light2D', 'shadow_enabled'],
  ['Light2D', 'shadow_color'],
  ['Light2D', 'shadow_filter'],
  ['Light2D', 'shadow_filter_smooth'],
];

describe('DirectionalLight2D strict validators', () => {
  it('registers exactly what DirectionalLight2D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('DirectionalLight2D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run against what this
    // test imported. `fixtureLint` owns the whole-registry version through the barrel.
    expectFixtureClean('unit-directional-light-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. This check is
    // vacuous when DirectionalLight2D declares nothing, which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('DirectionalLight2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key DirectionalLight2D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // DirectionalLight2D would answer here and could disagree with the ancestor.
      expect(validatorRegistry.findValidator('DirectionalLight2D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('DirectionalLight2D')).not.toContain(key);
    }
  });
});
