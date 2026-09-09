/**
 * NavigationObstacle2D strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('NavigationObstacle2D', property);
  expect(validator, `no validator registered for NavigationObstacle2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * NavigationObstacle2D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 *
 * doc/classes/NavigationObstacle2D.xml lists seven members, none carrying
 * `overrides=`: affect_navigation_mesh, avoidance_enabled, avoidance_layers,
 * carve_navigation_mesh, radius, velocity, vertices. Each has a real
 * ADD_PROPERTY in navigation_obstacle_2d.cpp:72-80 (velocity is
 * PROPERTY_USAGE_NO_EDITOR, which is also PROPERTY_USAGE_STORAGE and so still
 * serialises).
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
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys NavigationObstacle2D does NOT declare, each paired with the ancestor that does.
 * Name at least one; Node2D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives NavigationObstacle2D no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
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
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-navigation-obstacle-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // NavigationObstacle2D declares nothing, which is what INHERITED below covers.
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
      // The SAME function, not merely some validator: a shadowing copy on
      // NavigationObstacle2D would answer here while drifting from the ancestor's rule.
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

  // Both endpoints, from both sides: a mid-range accept plus a wildly
  // out-of-range reject pins the TIER of each bound but not its LOCATION.
  it('accepts the floor 0 itself (ERR_FAIL_COND_MSG at :247 refuses only below it)', () => {
    expect(check('radius', '0.0')).toBeNull();
  });

  it('rejects one hint step below the floor as an error', () => {
    // navigation_obstacle_2d.cpp:72 hints step 0.01, so -0.01 is the first
    // value the :247 `p_radius < 0.0` guard refuses. The VALUE code separates
    // this from the FORMAT branch, which also reports 'error' and so would
    // satisfy the severity assertion while pinning no bound at all.
    const result = check('radius', '-0.01');
    expect(result?.code).toBe('INVALID_RADIUS_VALUE');
    expect(result?.severity).toBe('error');
  });

  it('accepts the hinted ceiling 500 itself', () => {
    // navigation_obstacle_2d.cpp:72, "0.0,500,0.01,suffix:px" — closed, no or_greater.
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
  // navigation_obstacle_2d.cpp:79, PROPERTY_USAGE_NO_EDITOR is ALSO
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
