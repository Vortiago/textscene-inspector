/**
 * BackBufferCopy strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('BackBufferCopy', property);
  expect(validator, `no validator registered for BackBufferCopy.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * BackBufferCopy binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = ['copy_mode', 'rect'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys BackBufferCopy does NOT declare, each paired with the ancestor that does.
 * Name at least one; Node2D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives BackBufferCopy no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [['Node2D', 'position']];

describe('BackBufferCopy strict validators', () => {
  it('registers exactly what BackBufferCopy binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('BackBufferCopy').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-back-buffer-copy.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // BackBufferCopy declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('BackBufferCopy')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key BackBufferCopy inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // BackBufferCopy would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('BackBufferCopy', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('BackBufferCopy')).not.toContain(key);
    }
  });

  describe('copy_mode', () => {
    it('accepts every enum value Disabled/Rect/Viewport', () => {
      expect(check('copy_mode', '0')).toBeNull();
      expect(check('copy_mode', '1')).toBeNull();
      expect(check('copy_mode', '2')).toBeNull();
    });

    it('rejects a non-numeric value as a format error', () => {
      const error = check('copy_mode', 'Rect');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_COPY_MODE_FORMAT');
    });

    it('warns, rather than errors, on an out-of-range int: the hint bounds the inspector, not the setter', () => {
      // back_buffer_copy.cpp:73 `copy_mode = p_mode;` assigns unconditionally.
      const error = check('copy_mode', '3');
      expect(error?.severity).toBe('warning');
      expect(error?.code).toBe('INVALID_COPY_MODE_VALUE');
    });

    it('warns on a negative int the same way', () => {
      const error = check('copy_mode', '-1');
      expect(error?.severity).toBe('warning');
    });
  });

  describe('rect', () => {
    it('accepts a Rect2 literal', () => {
      expect(check('rect', 'Rect2(-100, -100, 200, 200)')).toBeNull();
    });

    it('accepts a Rect2 with non-finite components: back_buffer_copy.cpp:63 assigns without a finite check', () => {
      expect(check('rect', 'Rect2(inf, -inf, 0, 0)')).toBeNull();
    });

    it('rejects a malformed Rect2 literal', () => {
      const error = check('rect', 'Vector2(1, 2)');
      expect(error?.severity).toBe('error');
      expect(error?.code).toBe('INVALID_RECT_FORMAT');
    });
  });
});
