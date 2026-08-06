/**
 * NavigationLink2D strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('NavigationLink2D', property);
  expect(validator, `no validator registered for NavigationLink2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * NavigationLink2D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [
  'enabled',
  'bidirectional',
  'navigation_layers',
  'start_position',
  'end_position',
  'enter_cost',
  'travel_cost',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys NavigationLink2D does NOT declare, each paired with the ancestor that does.
 * Name at least one; Node2D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives NavigationLink2D no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [
  ['Node2D', 'position'],
  ['Node2D', 'rotation'],
];

describe('NavigationLink2D strict validators', () => {
  it('registers exactly what NavigationLink2D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('NavigationLink2D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-navigation-link-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // NavigationLink2D declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('NavigationLink2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key NavigationLink2D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // NavigationLink2D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('NavigationLink2D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('NavigationLink2D')).not.toContain(key);
    }
  });

  describe('enabled', () => {
    it('accepts true and false', () => {
      expect(check('enabled', 'true')).toBeNull();
      expect(check('enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean token', () => {
      expect(check('enabled', 'yes')).not.toBeNull();
    });
  });

  describe('bidirectional', () => {
    it('accepts true and false', () => {
      expect(check('bidirectional', 'true')).toBeNull();
      expect(check('bidirectional', 'false')).toBeNull();
    });

    it('rejects a non-boolean token', () => {
      expect(check('bidirectional', '1')).not.toBeNull();
    });
  });

  describe('navigation_layers', () => {
    it('accepts a value within the 32-bit layer mask', () => {
      expect(check('navigation_layers', '1')).toBeNull();
      expect(check('navigation_layers', '4294967295')).toBeNull();
    });

    it('rejects a non-numeric value as a format error', () => {
      // The FORMAT branch is always an error, hinted or not: unparsable input
      // is malformed whatever severity the range check would carry.
      const result = check('navigation_layers', 'not-a-number');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('warns rather than errors past the 32-bit mask', () => {
      // navigation_link_2d.cpp:205-213, set_navigation_layers is a bare
      // uint32_t assignment with no ERR_FAIL — PROPERTY_HINT_LAYERS_2D_NAVIGATION
      // (:75) only constrains the inspector's 32-checkbox widget, so an
      // out-of-range mask is ADR-0032's warning tier, not an error.
      const result = check('navigation_layers', '-1');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('warning');
    });
  });

  describe('start_position', () => {
    it('accepts a Vector2 literal', () => {
      expect(check('start_position', 'Vector2(10, 20)')).toBeNull();
    });

    it('rejects a malformed Vector2', () => {
      expect(check('start_position', 'Vector2(10)')).not.toBeNull();
    });
  });

  describe('end_position', () => {
    it('accepts a Vector2 literal', () => {
      expect(check('end_position', 'Vector2(-5, 30)')).toBeNull();
    });

    it('rejects a malformed Vector2', () => {
      expect(check('end_position', 'not-a-vector')).not.toBeNull();
    });
  });

  describe('enter_cost', () => {
    it('accepts zero, a positive float, and the non-finite spellings Godot writes', () => {
      // navigation_link_2d.cpp:310 only guards `p_enter_cost < 0.0`; `nan < 0.0`
      // is false in both C++ and JS, so Godot's own setter lets `nan` through.
      expect(check('enter_cost', '0')).toBeNull();
      expect(check('enter_cost', '5.5')).toBeNull();
      expect(check('enter_cost', 'inf')).toBeNull();
      expect(check('enter_cost', 'nan')).toBeNull();
    });

    it('errors on a negative value: the setter refuses it', () => {
      // navigation_link_2d.cpp:310, ERR_FAIL_COND_MSG(p_enter_cost < 0.0, ...).
      const result = check('enter_cost', '-1');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('errors on -inf, since -inf < 0.0 trips the same guard', () => {
      const result = check('enter_cost', '-inf');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });

  describe('travel_cost', () => {
    it('accepts zero, a positive float, and the non-finite spellings Godot writes', () => {
      // navigation_link_2d.cpp:321 only guards `p_travel_cost < 0.0`, same shape
      // as enter_cost above.
      expect(check('travel_cost', '0')).toBeNull();
      expect(check('travel_cost', '1')).toBeNull();
      expect(check('travel_cost', 'inf')).toBeNull();
      expect(check('travel_cost', 'nan')).toBeNull();
    });

    it('errors on a negative value: the setter refuses it', () => {
      // navigation_link_2d.cpp:321, ERR_FAIL_COND_MSG(p_travel_cost < 0.0, ...).
      const result = check('travel_cost', '-1');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('errors on -inf, since -inf < 0.0 trips the same guard', () => {
      const result = check('travel_cost', '-inf');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });
  });
});
