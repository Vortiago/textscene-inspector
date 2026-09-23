/**
 * NavigationLink3D strict validators, asserted through `validatorRegistry` so a
 * failure points at the validator rather than at scene parsing. Rule-level
 * behaviour belongs in linter.test.ts. Quote the governing Godot source line
 * beside every numeric bound.
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
 * The keys NavigationLink3D binds, read from the source. Set this or DECLARES_NOTHING:
 * both unset fails on purpose. Never delete an assertion to pass.
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
 * At least one key NavigationLink3D inherits, with the ancestor that declares it.
 * The malformed-value sweep iterates `getOwnKeys`, so it passes vacuously on a
 * class that declares nothing. Resolving a key to the ancestor's own validator
 * tells "declares nothing" apart from "not written yet".
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
    // Runs the fixture's zero-diagnostic claim against what this test imports.
    // `fixtureLint` covers the whole registry but needs the barrel.
    expectFixtureClean('unit-navigation-link-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. Vacuous
    // when NavigationLink3D declares nothing, which INHERITED covers.
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
      // The same function, not merely some validator: a shadowing copy on
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
      // A capitalised spelling is no Variant literal, so nothing converts it, unlike
      // the int spelling, which the slot converts.
      expect(check('enabled', 'True')?.severity).toBe('error');
    });
  });

  describe('bidirectional', () => {
    it('accepts true and false', () => {
      expect(check('bidirectional', 'true')).toBeNull();
      expect(check('bidirectional', 'false')).toBeNull();
    });

    it('rejects a non-boolean literal', () => {
      expect(check('bidirectional', '1')?.severity).toBe('warning');
    });
  });

  describe('navigation_layers', () => {
    it('accepts a value within the 32-bit mask', () => {
      expect(check('navigation_layers', '1')).toBeNull();
      expect(check('navigation_layers', '4294967295')).toBeNull();
    });

    it('rejects a non-integer as a format error', () => {
      // navigation_link_3d.cpp:366-374 is a bare uint32_t assignment. A format failure
      // always errors (ADR-0032).
      expect(check('navigation_layers', 'not-a-number')?.severity).toBe('error');
    });

    it('takes -1, and errors only past the 32-bit mask', () => {
      // navigation_link_3d.cpp:214, PROPERTY_HINT_LAYERS_3D_NAVIGATION. The
      // 32 checkboxes render every pattern, so only a dropped bit reports.
      expect(check('navigation_layers', '-1')).toBeNull();
      expect(check('navigation_layers', '4294967296')?.severity).toBe('error');
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
      // `inf < 0.0` and `nan < 0.0` are false, so those pass. `-inf < 0.0` is true, so it
      // is refused like any other negative value.
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
