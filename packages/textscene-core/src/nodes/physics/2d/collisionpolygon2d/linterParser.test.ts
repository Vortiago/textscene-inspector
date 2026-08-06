/**
 * CollisionPolygon2D strict validators — format and range checks.
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
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('CollisionPolygon2D', property);
  expect(validator, `no validator registered for CollisionPolygon2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * CollisionPolygon2D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 *
 * doc/classes/CollisionPolygon2D.xml lists five members, none carrying
 * `overrides=`: build_mode, disabled, one_way_collision,
 * one_way_collision_margin, polygon. Each has a real ADD_PROPERTY in
 * collision_polygon_2d.cpp:308-314.
 */
const KEYS: string[] = [
  'build_mode',
  'polygon',
  'disabled',
  'one_way_collision',
  'one_way_collision_margin',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys CollisionPolygon2D does NOT declare, each paired with the ancestor that does.
 * Name at least one; Node2D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives CollisionPolygon2D no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [
  ['Node2D', 'position'],
  ['Node2D', 'rotation'],
];

describe('CollisionPolygon2D strict validators', () => {
  it('registers exactly what CollisionPolygon2D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('CollisionPolygon2D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-collision-polygon-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // CollisionPolygon2D declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('CollisionPolygon2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key CollisionPolygon2D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // CollisionPolygon2D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('CollisionPolygon2D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('CollisionPolygon2D')).not.toContain(key);
    }
  });
});

describe('build_mode', () => {
  // collision_polygon_2d.cpp:308, PROPERTY_HINT_ENUM "Solids,Segments".
  // set_build_mode (:203-212) opens with `ERR_FAIL_INDEX((int)p_mode, 2)`
  // (:204), which refuses (skips) the assignment outright.
  it('accepts BUILD_SOLIDS (0)', () => {
    expect(check('build_mode', '0')).toBeNull();
  });

  it('accepts BUILD_SEGMENTS (1)', () => {
    expect(check('build_mode', '1')).toBeNull();
  });

  it('rejects a non-numeric value as an error', () => {
    const result = check('build_mode', 'Solids');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('error');
  });

  it('rejects an out-of-range value as an error (setter guard refuses it)', () => {
    const result = check('build_mode', '2');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('error');
  });

  it('rejects a negative value as an error (ERR_FAIL_INDEX also refuses index < 0)', () => {
    const result = check('build_mode', '-1');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('error');
  });
});

describe('polygon', () => {
  // collision_polygon_2d.cpp:309 — PropertyInfo(Variant::PACKED_VECTOR2_ARRAY,
  // "polygon"). get_polygon (:199-201) returns the real Vector<Point2> field
  // directly (not a TypedArray behind the packed hint), so the corpus spells
  // it PackedVector2Array(...), e.g.
  // scenes/demos/2d/finite_state_machine/player/Player.tscn.
  it('accepts a well-formed PackedVector2Array', () => {
    expect(check('polygon', 'PackedVector2Array(-10, -10, 10, -10, 10, 10, -10, 10)')).toBeNull();
  });

  it('accepts an empty PackedVector2Array (the default)', () => {
    expect(check('polygon', 'PackedVector2Array()')).toBeNull();
  });

  it('rejects a non-numeric element as an error', () => {
    const result = check('polygon', 'PackedVector2Array(a, b)');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('error');
  });

  it('accepts an odd element count (VariantParser drops the trailing coordinate via integer division, variant_parser.cpp:1555)', () => {
    expect(check('polygon', 'PackedVector2Array(0, 0, 1)')).toBeNull();
  });
});

describe('disabled', () => {
  // collision_polygon_2d.cpp:310, plain BOOL. set_disabled (:259-265) assigns
  // unconditionally.
  it('accepts true', () => {
    expect(check('disabled', 'true')).toBeNull();
  });

  it('accepts false', () => {
    expect(check('disabled', 'false')).toBeNull();
  });

  it('rejects a non-boolean value', () => {
    expect(check('disabled', 'yes')).not.toBeNull();
  });
});

describe('one_way_collision', () => {
  // collision_polygon_2d.cpp:313, BOOL with PROPERTY_HINT_GROUP_ENABLE — an
  // inspector group-header toggle, not a range hint. set_one_way_collision
  // (:271-278) assigns unconditionally.
  it('accepts true', () => {
    expect(check('one_way_collision', 'true')).toBeNull();
  });

  it('accepts false', () => {
    expect(check('one_way_collision', 'false')).toBeNull();
  });

  it('rejects a non-boolean value', () => {
    expect(check('one_way_collision', 'yes')).not.toBeNull();
  });
});

describe('one_way_collision_margin', () => {
  // collision_polygon_2d.cpp:314, PROPERTY_HINT_RANGE "0,128,0.1,suffix:px".
  // set_one_way_collision_margin (:284-289) is a bare assignment, so
  // out-of-range is a warning, not an error.
  it('accepts a value within the hinted range', () => {
    expect(check('one_way_collision_margin', '4.0')).toBeNull();
  });

  it('accepts the hinted floor (0)', () => {
    expect(check('one_way_collision_margin', '0')).toBeNull();
  });

  it('accepts the hinted ceiling (128)', () => {
    expect(check('one_way_collision_margin', '128')).toBeNull();
  });

  it('rejects a non-numeric value as an error', () => {
    const result = check('one_way_collision_margin', 'wide');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('error');
  });

  it('accepts a value below the hinted floor as a warning only (setter never checks it)', () => {
    const result = check('one_way_collision_margin', '-1');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('warning');
  });

  it('accepts a value above the hinted 128 ceiling as a warning only (setter never checks it)', () => {
    const result = check('one_way_collision_margin', '200');
    expect(result).not.toBeNull();
    expect(result?.severity).toBe('warning');
  });
});
