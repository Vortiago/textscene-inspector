/**
 * Tests the NavigationLink2D strict validators through `validatorRegistry`, not
 * by linting a `.tscn`, so a failure points at the validator. Rule behaviour is
 * in linter.test.ts.
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
 * Set exactly one, from the engine source: the keys NavigationLink2D binds, or
 * DECLARES_NOTHING when it binds no ADD_PROPERTY. Both unset is red on purpose.
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
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys NavigationLink2D inherits, each with the ancestor that declares it. The
 * malformed-value sweep iterates `getOwnKeys`, so on a class that declares
 * nothing it passes vacuously. Resolving an inherited key to the ancestor's own
 * validator tells an empty class from an unwritten slice.
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
    // `fixtureLint` covers the whole registry through the barrel. This checks
    // the fixture against only what this test imports.
    expectFixtureClean('unit-navigation-link-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. Vacuous when
    // the class declares nothing, which INHERITED covers.
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
      // The same function, not merely some validator: a shadowing copy would
      // answer here while it drifts from the ancestor's rule.
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
      // The format branch is always an error, hinted or not.
      const result = check('navigation_layers', 'not-a-number');
      expect(result).not.toBeNull();
      expect(result!.severity).toBe('error');
    });

    it('takes -1, and errors only past the 32-bit mask', () => {
      // navigation_link_2d.cpp:205-213, set_navigation_layers is a bare
      // uint32_t assignment with no ERR_FAIL, and PROPERTY_HINT_LAYERS_2D_NAVIGATION
      // (:75) renders every 32-bit pattern, this one included.
      expect(check('navigation_layers', '-1')).toBeNull();
      expect(check('navigation_layers', '4294967296')?.severity).toBe('error');
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
