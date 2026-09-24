/**
 * Tests the NavigationObstacle2D strict validators through `validatorRegistry`, not by
 * linting a `.tscn`, so a failure points at the validator.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('NavigationObstacle2D', property);
  expect(validator, `no validator registered for NavigationObstacle2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly one, from the engine source: the keys NavigationObstacle2D binds, or
 * DECLARES_NOTHING when it binds no ADD_PROPERTY. Both unset is red on purpose.
 * doc/classes/NavigationObstacle2D.xml lists these seven, none with `overrides=`,
 * each an ADD_PROPERTY in navigation_obstacle_2d.cpp:72-80.
 */
const KEYS: string[] = [
  'radius',
  'vertices',
  'affect_navigation_mesh',
  'carve_navigation_mesh',
  'avoidance_enabled',
  'velocity',
  'avoidance_layers',
];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys NavigationObstacle2D inherits, each with the ancestor that declares it. The
 * malformed-value sweep iterates `getOwnKeys`, so it passes vacuously on a class
 * that declares nothing. This tells an empty class from an unwritten slice.
 */
const INHERITED: [owner: string, key: string][] = [
  ['Node2D', 'position'],
  ['Node2D', 'transform'],
];

describe('NavigationObstacle2D strict validators', () => {
  it('registers exactly what NavigationObstacle2D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('NavigationObstacle2D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // `fixtureLint` covers the whole registry through the barrel. This checks
    // the fixture against only what this test imports.
    expectFixtureClean('unit-navigation-obstacle-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. Vacuous when
    // the class declares nothing, which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('NavigationObstacle2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key NavigationObstacle2D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy would
      // answer here while it drifts from the ancestor's rule.
      expect(validatorRegistry.findValidator('NavigationObstacle2D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('NavigationObstacle2D')).not.toContain(key);
    }
  });
});

describe('radius', () => {
  // navigation_obstacle_2d.cpp:247, ERR_FAIL_COND_MSG(p_radius < 0.0, ...).
  it('accepts a value within the hinted range', () => {
    expect(check('radius', '50.0')).toBeNull();
  });

  it('rejects a negative value as an error (setter refuses it)', () => {
    const result = check('radius', '-1.0');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('error');
  });

  it('accepts a value above the hinted 500 ceiling as a warning only (setter never checks the ceiling)', () => {
    const result = check('radius', '600.0');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('warning');
  });

  // Both endpoints, from both sides: a mid-range accept plus a far
  // out-of-range reject pins the tier of each bound but not its location.
  it('accepts the floor 0 itself (ERR_FAIL_COND_MSG at :247 refuses only below it)', () => {
    expect(check('radius', '0.0')).toBeNull();
  });

  it('rejects one hint step below the floor as an error', () => {
    // navigation_obstacle_2d.cpp:72 hints step 0.01, so -0.01 is the first
    // value the :247 `p_radius < 0.0` guard refuses. The value code separates
    // this from the format branch, which also reports 'error'.
    const result = check('radius', '-0.01');
    expect(result?.code).toBe('INVALID_RADIUS_VALUE');
    expect(result?.severity).toBe('error');
  });

  it('accepts the hinted ceiling 500 itself', () => {
    // navigation_obstacle_2d.cpp:72, "0.0,500,0.01,suffix:px": closed, no or_greater.
    expect(check('radius', '500.0')).toBeNull();
  });

  it('warns one hint step above the ceiling', () => {
    const result = check('radius', '500.01');
    expect(result?.code).toBe('INVALID_RADIUS_VALUE');
    expect(result?.severity).toBe('warning');
  });
});

describe('vertices', () => {
  // navigation_obstacle_2d.cpp:73, PACKED_VECTOR2_ARRAY.
  it('accepts a well-formed PackedVector2Array', () => {
    expect(check('vertices', 'PackedVector2Array(0, 0, 100, 0, 100, 100)')).toBeNull();
  });

  it('rejects a non-numeric element', () => {
    const result = check('vertices', 'PackedVector2Array(a, b)');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('error');
  });

  it('accepts an odd element count (VariantParser drops the trailing coordinate via integer division, variant_parser.cpp:1555)', () => {
    expect(check('vertices', 'PackedVector2Array(0, 0, 1)')).toBeNull();
  });
});

describe('affect_navigation_mesh', () => {
  // navigation_obstacle_2d.cpp:75, plain BOOL.
  it('accepts true', () => {
    expect(check('affect_navigation_mesh', 'true')).toBeNull();
  });

  it('accepts false', () => {
    expect(check('affect_navigation_mesh', 'false')).toBeNull();
  });

  it('rejects a non-boolean value', () => {
    expect(check('affect_navigation_mesh', 'yes')).not.toBeNull();
  });
});

describe('carve_navigation_mesh', () => {
  // navigation_obstacle_2d.cpp:76, plain BOOL.
  it('accepts true', () => {
    expect(check('carve_navigation_mesh', 'true')).toBeNull();
  });

  it('accepts false', () => {
    expect(check('carve_navigation_mesh', 'false')).toBeNull();
  });

  it('rejects a non-boolean value', () => {
    expect(check('carve_navigation_mesh', 'yes')).not.toBeNull();
  });
});

describe('avoidance_enabled', () => {
  // navigation_obstacle_2d.cpp:78, PROPERTY_HINT_GROUP_ENABLE is an inspector
  // grouping widget, not a range hint.
  it('accepts true', () => {
    expect(check('avoidance_enabled', 'true')).toBeNull();
  });

  it('accepts false', () => {
    expect(check('avoidance_enabled', 'false')).toBeNull();
  });

  it('rejects a non-boolean value', () => {
    expect(check('avoidance_enabled', 'yes')).not.toBeNull();
  });
});

describe('velocity', () => {
  // navigation_obstacle_2d.cpp:79, PROPERTY_USAGE_NO_EDITOR is also
  // PROPERTY_USAGE_STORAGE (object.h:132), so it serialises and is validated
  // despite hiding from the inspector.
  it('accepts a well-formed Vector2', () => {
    expect(check('velocity', 'Vector2(0, 0)')).toBeNull();
  });

  it('rejects a malformed value', () => {
    expect(check('velocity', 'Vector2(0)')).not.toBeNull();
  });

  it('accepts an arbitrarily large magnitude (set_velocity assigns straight through, no bound)', () => {
    expect(check('velocity', 'Vector2(-999999, 1000000)')).toBeNull();
  });
});

describe('avoidance_layers', () => {
  // navigation_obstacle_2d.cpp:80, PROPERTY_HINT_LAYERS_AVOIDANCE. Bare
  // uint32_t assignment in set_avoidance_layers (:261): out-of-range is a
  // language-level reinterpretation, not a guard, so it is a warning.
  it('accepts a valid bitmask', () => {
    expect(check('avoidance_layers', '3')).toBeNull();
  });

  it('rejects a non-numeric value as an error', () => {
    const result = check('avoidance_layers', 'abc');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('error');
  });

  it('accepts a negative value: the uint32_t reinterpretation loses nothing', () => {
    expect(check('avoidance_layers', '-1')).toBeNull();
  });
});
