/**
 * NavigationObstacle3D strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('NavigationObstacle3D', property);
  expect(validator, `no validator registered for NavigationObstacle3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * NavigationObstacle3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 *
 * doc/classes/NavigationObstacle3D.xml lists nine members, none carrying
 * `overrides=`: affect_navigation_mesh, avoidance_enabled, avoidance_layers,
 * carve_navigation_mesh, height, radius, use_3d_avoidance, velocity, vertices.
 * Each has a real ADD_PROPERTY in navigation_obstacle_3d.cpp:77-87 (velocity
 * is PROPERTY_USAGE_NO_EDITOR, which is also PROPERTY_USAGE_STORAGE and so
 * still serialises).
 */
const KEYS: string[] = [
  'radius',
  'height',
  'vertices',
  'affect_navigation_mesh',
  'carve_navigation_mesh',
  'avoidance_enabled',
  'velocity',
  'avoidance_layers',
  'use_3d_avoidance',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys NavigationObstacle3D does NOT declare, each paired with the ancestor that does.
 * Name at least one; Node3D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives NavigationObstacle3D no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [
  ['Node3D', 'transform'],
  ['Node3D', 'visible'],
];

describe('NavigationObstacle3D strict validators', () => {
  it('registers exactly what NavigationObstacle3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('NavigationObstacle3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-navigation-obstacle-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // NavigationObstacle3D declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('NavigationObstacle3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key NavigationObstacle3D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // NavigationObstacle3D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('NavigationObstacle3D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('NavigationObstacle3D')).not.toContain(key);
    }
  });
});

describe('radius', () => {
  // navigation_obstacle_3d.cpp:77, PROPERTY_HINT_RANGE "0.0,100,0.01,suffix:m",
  // a CLOSED max with no or_greater. :308 ERR_FAIL_COND_MSG(p_radius < 0.0,
  // ...) enforces the floor; the setter never checks the 100 ceiling.
  it('accepts a value within the hinted range', () => {
    expect(check('radius', '50.0')).toBeNull();
  });

  it('rejects a negative value as an error (setter refuses it)', () => {
    const result = check('radius', '-1.0');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('error');
  });

  it('accepts a value above the hinted 100 ceiling as a warning only (setter never checks the ceiling)', () => {
    const result = check('radius', '150.0');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('warning');
  });

  it('warns on positive infinity: `inf > 100` trips the hinted ceiling, the setter never checks it', () => {
    expect(check('radius', 'inf')?.severity).toBe('warning');
  });

  it('errors on negative infinity: `inf_neg < 0.0` trips the enforced floor exactly like any other negative', () => {
    expect(check('radius', 'inf_neg')?.severity).toBe('error');
  });

  it('accepts nan: every comparison against nan is false, so neither bound trips', () => {
    expect(check('radius', 'nan')).toBeNull();
  });
});

describe('height', () => {
  // navigation_obstacle_3d.cpp:78, same closed-max split as radius: :326
  // ERR_FAIL_COND_MSG(p_height < 0.0, ...) enforces the floor, the 100
  // ceiling is hint-only.
  it('accepts a value within the hinted range', () => {
    expect(check('height', '50.0')).toBeNull();
  });

  it('rejects a negative value as an error (setter refuses it)', () => {
    const result = check('height', '-1.0');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('error');
  });

  it('accepts a value above the hinted 100 ceiling as a warning only (setter never checks the ceiling)', () => {
    const result = check('height', '150.0');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('warning');
  });

  it('warns on positive infinity: `inf > 100` trips the hinted ceiling, the setter never checks it', () => {
    expect(check('height', 'inf')?.severity).toBe('warning');
  });

  it('errors on negative infinity: `inf_neg < 0.0` trips the enforced floor exactly like any other negative', () => {
    expect(check('height', 'inf_neg')?.severity).toBe('error');
  });

  it('accepts nan: every comparison against nan is false, so neither bound trips', () => {
    expect(check('height', 'nan')).toBeNull();
  });
});

describe('vertices', () => {
  // navigation_obstacle_3d.cpp:79, PACKED_VECTOR3_ARRAY. get_vertices (.h:102)
  // returns a plain `const Vector<Vector3> &`, not a TypedArray, so it
  // serialises as PackedVector3Array(...).
  it('accepts a well-formed PackedVector3Array', () => {
    expect(check('vertices', 'PackedVector3Array(0, 0, 0, 1, 0, 0, 1, 0, 1)')).toBeNull();
  });

  it('accepts an empty PackedVector3Array', () => {
    expect(check('vertices', 'PackedVector3Array()')).toBeNull();
  });

  it('rejects a non-numeric element', () => {
    const result = check('vertices', 'PackedVector3Array(a, b, c)');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('error');
  });

  it('accepts a count that is not a multiple of 3 (VariantParser drops the remainder via integer division, variant_parser.cpp:1573)', () => {
    expect(check('vertices', 'PackedVector3Array(0, 0, 0, 1)')).toBeNull();
  });
});

describe('affect_navigation_mesh', () => {
  // navigation_obstacle_3d.cpp:81, plain BOOL.
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
  // navigation_obstacle_3d.cpp:82, plain BOOL.
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
  // navigation_obstacle_3d.cpp:84, PROPERTY_HINT_GROUP_ENABLE is an inspector
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
  // navigation_obstacle_3d.cpp:85, PROPERTY_USAGE_NO_EDITOR is ALSO
  // PROPERTY_USAGE_STORAGE (object.h:132), so it serialises and is validated
  // despite hiding from the inspector. set_velocity (:387) assigns straight
  // through, no bound.
  it('accepts a well-formed Vector3', () => {
    expect(check('velocity', 'Vector3(0, 0, 0)')).toBeNull();
  });

  it('rejects a malformed value', () => {
    expect(check('velocity', 'Vector3(0, 0)')).not.toBeNull();
  });

  it('accepts an arbitrarily large magnitude (set_velocity assigns straight through, no bound)', () => {
    expect(check('velocity', 'Vector3(-999999, 1000000, -999999)')).toBeNull();
  });
});

describe('avoidance_layers', () => {
  // navigation_obstacle_3d.cpp:86, PROPERTY_HINT_LAYERS_AVOIDANCE. Bare
  // uint32_t assignment in set_avoidance_layers (:341): out-of-range is a
  // language-level reinterpretation, not a guard, so it is a warning.
  it('accepts a valid bitmask', () => {
    expect(check('avoidance_layers', '3')).toBeNull();
  });

  it('rejects a non-numeric value as an error', () => {
    const result = check('avoidance_layers', 'abc');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('error');
  });

  it('accepts a negative value as a warning only (uint32_t reinterprets it, not a setter guard)', () => {
    const result = check('avoidance_layers', '-1');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('warning');
  });
});

describe('use_3d_avoidance', () => {
  // navigation_obstacle_3d.cpp:87, plain BOOL.
  it('accepts true', () => {
    expect(check('use_3d_avoidance', 'true')).toBeNull();
  });

  it('accepts false', () => {
    expect(check('use_3d_avoidance', 'false')).toBeNull();
  });

  it('rejects a non-boolean value', () => {
    expect(check('use_3d_avoidance', 'yes')).not.toBeNull();
  });
});

describe('NavigationObstacle3D inherits the Node3D shape keys', () => {
  it("applies the parent's format rather than accepting anything", () => {
    expect(check('transform', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)')).toBeNull();
    expect(check('transform', 'Transform3D(nope)')).not.toBeNull();
  });
});
