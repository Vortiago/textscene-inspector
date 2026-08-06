/**
 * NavigationLink3D strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('NavigationLink3D', property);
  expect(validator, `no validator registered for NavigationLink3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * NavigationLink3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
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
 * Keys NavigationLink3D does NOT declare, each paired with the ancestor that does.
 * Name at least one; Node3D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives NavigationLink3D no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [
  ['Node3D', 'transform'],
  ['Node3D', 'visible'],
];

describe('NavigationLink3D strict validators', () => {
  it('registers exactly what NavigationLink3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('NavigationLink3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-navigation-link-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // NavigationLink3D declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('NavigationLink3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key NavigationLink3D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // NavigationLink3D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('NavigationLink3D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('NavigationLink3D')).not.toContain(key);
    }
  });

  describe('enabled', () => {
    it('accepts true and false', () => {
      expect(check('enabled', 'true')).toBeNull();
      expect(check('enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      // createBooleanValidator matches the literal 'true'/'false' only.
      expect(check('enabled', 'True')?.severity).toBe('error');
    });
  });

  describe('bidirectional', () => {
    it('accepts true and false', () => {
      expect(check('bidirectional', 'true')).toBeNull();
      expect(check('bidirectional', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('bidirectional', '1')?.severity).toBe('error');
    });
  });

  describe('navigation_layers', () => {
    it('accepts a value within the 32-bit mask', () => {
      expect(check('navigation_layers', '1')).toBeNull();
      expect(check('navigation_layers', '4294967295')).toBeNull();
    });

    it('rejects a non-integer as a format error', () => {
      // navigation_link_3d.cpp:366-374 is a bare uint32_t assignment; the
      // FORMAT branch is unconditionally an error (ADR-0032).
      expect(check('navigation_layers', 'not-a-number')?.severity).toBe('error');
    });

    it('warns rather than errors outside the mask, since only the hint bounds it', () => {
      // navigation_link_3d.cpp:214, PROPERTY_HINT_LAYERS_3D_NAVIGATION. No
      // ERR_FAIL in the setter, so an out-of-range value is a WARNING.
      expect(check('navigation_layers', '-1')?.severity).toBe('warning');
      expect(check('navigation_layers', '4294967296')?.severity).toBe('warning');
    });
  });

  describe('start_position', () => {
    it('accepts a Vector3 literal', () => {
      expect(check('start_position', 'Vector3(1, 2, 3)')).toBeNull();
    });

    it('rejects a malformed literal', () => {
      expect(check('start_position', 'Vector3(1, 2)')?.severity).toBe('error');
    });

    it('accepts inf/nan components, since the setter carries no finite guard', () => {
      // navigation_link_3d.cpp:398-411: only an is_equal_approx early return,
      // no ERR_FAIL_COND(!is_finite(...)).
      expect(check('start_position', 'Vector3(inf, -inf, nan)')).toBeNull();
    });
  });

  describe('end_position', () => {
    it('accepts a Vector3 literal', () => {
      expect(check('end_position', 'Vector3(2, 0, 0)')).toBeNull();
    });

    it('rejects a malformed literal', () => {
      expect(check('end_position', 'not-a-vector')?.severity).toBe('error');
    });

    it('accepts inf/nan components, since the setter carries no finite guard', () => {
      // navigation_link_3d.cpp:419-432: same shape as start_position.
      expect(check('end_position', 'Vector3(inf, -inf, nan)')).toBeNull();
    });
  });

  describe('enter_cost', () => {
    it('accepts zero and a positive value', () => {
      expect(check('enter_cost', '0')).toBeNull();
      expect(check('enter_cost', '2.5')).toBeNull();
    });

    it('rejects a non-numeric value as a format error', () => {
      expect(check('enter_cost', 'not-a-number')?.severity).toBe('error');
    });

    it('errors on a negative value, which the setter refuses outright', () => {
      // navigation_link_3d.cpp:473, ERR_FAIL_COND_MSG(p_enter_cost < 0.0, ...).
      expect(check('enter_cost', '-1')?.severity).toBe('error');
    });

    it('accepts positive infinity and nan, rejects negative infinity', () => {
      // `inf < 0.0` and `nan < 0.0` are both false in the ERR_FAIL_COND
      // comparison, so those pass through; `-inf < 0.0` is true, so it is
      // refused exactly like any other negative value.
      expect(check('enter_cost', 'inf')).toBeNull();
      expect(check('enter_cost', 'nan')).toBeNull();
      expect(check('enter_cost', 'inf_neg')?.severity).toBe('error');
    });
  });

  describe('travel_cost', () => {
    it('accepts zero and a positive value', () => {
      expect(check('travel_cost', '0')).toBeNull();
      expect(check('travel_cost', '1.0')).toBeNull();
    });

    it('rejects a non-numeric value as a format error', () => {
      expect(check('travel_cost', 'not-a-number')?.severity).toBe('error');
    });

    it('errors on a negative value, which the setter refuses outright', () => {
      // navigation_link_3d.cpp:484, ERR_FAIL_COND_MSG(p_travel_cost < 0.0, ...).
      expect(check('travel_cost', '-1')?.severity).toBe('error');
    });

    it('accepts positive infinity and nan, rejects negative infinity', () => {
      expect(check('travel_cost', 'inf')).toBeNull();
      expect(check('travel_cost', 'nan')).toBeNull();
      expect(check('travel_cost', 'inf_neg')?.severity).toBe('error');
    });
  });
});
