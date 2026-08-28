/**
 * CanvasGroup strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('CanvasGroup', property);
  expect(validator, `no validator registered for CanvasGroup.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * CanvasGroup binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = ['fit_margin', 'clear_margin', 'use_mipmaps'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys CanvasGroup does NOT declare, each paired with the ancestor that does.
 * Name at least one; Node2D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives CanvasGroup no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
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
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-canvas-group.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // CanvasGroup declares nothing, which is what INHERITED below covers.
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
      // The SAME function, not merely some validator: a shadowing copy on
      // CanvasGroup would answer here while drifting from the ancestor's rule.
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
