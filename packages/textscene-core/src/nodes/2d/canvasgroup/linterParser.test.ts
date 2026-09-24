/**
 * CanvasGroup strict validators: format and range checks, asserted through
 * `validatorRegistry` so a failure points at the validator, not at scene parsing.
 * Each numeric bound quotes its governing Godot source line.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('CanvasGroup', property);
  expect(validator, `no validator registered for CanvasGroup.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys CanvasGroup binds, read from the source. Set this or DECLARES_NOTHING:
 * leaving both unset fails on purpose.
 */
const KEYS: string[] = ['fit_margin', 'clear_margin', 'use_mipmaps'];
/** True only when the class binds no ADD_PROPERTY, with the source line that proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys CanvasGroup does not declare, each paired with the ancestor that does.
 * The malformed-value check iterates `getOwnKeys`, so it passes vacuously on a
 * class that declares nothing. Resolving a key to the ancestor's own validator
 * tells "declares nothing" apart from "not written yet".
 */
const INHERITED: [owner: string, key: string][] = [['Node2D', 'position']];

describe('CanvasGroup strict validators', () => {
  it('registers exactly what CanvasGroup binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('CanvasGroup').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run against what this
    // test imported. `fixtureLint` owns the whole-registry version through the barrel.
    expectFixtureClean('unit-canvas-group.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. This check is
    // vacuous when CanvasGroup declares nothing, which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('CanvasGroup')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key CanvasGroup inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // CanvasGroup would answer here and could disagree with the ancestor.
      expect(validatorRegistry.findValidator('CanvasGroup', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('CanvasGroup')).not.toContain(key);
    }
  });

  describe.each(['fit_margin', 'clear_margin'] as const)('%s', (prop) => {
    it('accepts the default 10.0', () => {
      expect(check(prop, '10.0')).toBeNull();
    });

    it('accepts 0, the enforced floor', () => {
      expect(check(prop, '0')).toBeNull();
    });

    it('accepts a value past 1024: the hint ceiling is opened by ,or_greater', () => {
      expect(check(prop, '5000')).toBeNull();
    });

    it('rejects a non-numeric value as a format error', () => {
      const error = check(prop, 'not-a-number');
      expect(error?.severity).toBe('error');
    });

    it('errors on a negative value: the setter refuses it outright', () => {
      // canvas_group.cpp:34 / :47 `ERR_FAIL_COND(p_*_margin < 0.0)`.
      const error = check(prop, '-1');
      expect(error?.severity).toBe('error');
    });
  });

  describe('use_mipmaps', () => {
    it('accepts true and false', () => {
      expect(check('use_mipmaps', 'true')).toBeNull();
      expect(check('use_mipmaps', 'false')).toBeNull();
    });

    it('rejects anything else', () => {
      const error = check('use_mipmaps', '1');
      expect(error?.severity).toBe('warning');
    });
  });
});
