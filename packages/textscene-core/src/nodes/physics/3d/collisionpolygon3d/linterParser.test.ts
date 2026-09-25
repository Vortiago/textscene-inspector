/**
 * CollisionPolygon3D strict validators, asserted through `validatorRegistry`, not by
 * linting a `.tscn`, so a failure points at the validator and no fixture text needs upkeep.
 * Rule-level behaviour belongs in linter.test.ts. Each property gets happy, malformed and bound
 * cases, with the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('CollisionPolygon3D', property);
  expect(validator, `no validator registered for CollisionPolygon3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys CollisionPolygon3D binds, from the source. Set this or DECLARES_NOTHING, never
 * neither.
 */
const KEYS: string[] = ['depth', 'disabled', 'polygon', 'margin', 'debug_color', 'debug_fill'];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys CollisionPolygon3D does not declare, each paired with the ancestor that does. The
 * malformed-value check iterates `getOwnKeys`, so it passes vacuously on an empty set.
 * Resolving a key through the base-walk to the ancestor's own validator tells a class that
 * declares nothing from an unwritten slice.
 */
const INHERITED: [owner: string, key: string][] = [
  ['Node3D', 'transform'],
  ['Node3D', 'visible'],
  ['Node', 'process_mode'],
];

describe('CollisionPolygon3D strict validators', () => {
  it('registers exactly what CollisionPolygon3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('CollisionPolygon3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run rather than reasoned.
    // `fixtureLint` owns the whole-registry version but needs the barrel. This checks the
    // same file against only what this test imported.
    expectFixtureClean('unit-collision-polygon-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. This check is generic
    // on purpose, and per-property cases follow. It is vacuous when the class declares nothing,
    // which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('CollisionPolygon3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key CollisionPolygon3D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // CollisionPolygon3D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('CollisionPolygon3D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('CollisionPolygon3D')).not.toContain(key);
    }
  });
});

describe('CollisionPolygon3D.depth', () => {
  it('accepts an ordinary float', () => {
    expect(check('depth', '1.0')).toBeNull();
    expect(check('depth', '2.5')).toBeNull();
  });

  it('accepts zero and negative values, since set_depth has no clamp or ERR_FAIL', () => {
    // collision_polygon_3d.cpp:139-143 assigns `depth = p_depth` unconditionally.
    expect(check('depth', '0')).toBeNull();
    expect(check('depth', '-5')).toBeNull();
  });

  it('accepts the non-finite literals Godot writes and reloads, since PROPERTY_HINT_NONE opens both ends', () => {
    expect(check('depth', 'inf')).toBeNull();
    expect(check('depth', '-inf')).toBeNull();
    expect(check('depth', 'nan')).toBeNull();
  });

  it('rejects a non-numeric value', () => {
    expect(check('depth', '"one"')).not.toBeNull();
  });
});

describe('CollisionPolygon3D.disabled', () => {
  it('accepts true and false', () => {
    expect(check('disabled', 'true')).toBeNull();
    expect(check('disabled', 'false')).toBeNull();
  });

  it('rejects anything else', () => {
    expect(check('disabled', 'True')).not.toBeNull();
    expect(check('disabled', '1')).not.toBeNull();
  });
});

describe('CollisionPolygon3D.polygon', () => {
  it('accepts a PackedVector2Array literal with several vertices', () => {
    expect(check('polygon', 'PackedVector2Array(-0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5)')).toBeNull();
  });

  it('accepts the empty array Godot serialises for a cleared polygon', () => {
    expect(check('polygon', 'PackedVector2Array()')).toBeNull();
  });

  it('does not reject an odd component count, since VariantParser drops the trailing coordinate (integer division)', () => {
    // variant_parser.cpp:1555 builds the array with `int len = args.size() / 2`,
    // so a truncated final vertex silently loads rather than failing to parse.
    expect(check('polygon', 'PackedVector2Array(0, 0, 1)')).toBeNull();
  });

  it('rejects a value missing the PackedVector2Array wrapper', () => {
    expect(check('polygon', 'Vector2(0, 0)')).not.toBeNull();
  });

  it('rejects a non-numeric component', () => {
    expect(check('polygon', 'PackedVector2Array(0, "x")')).not.toBeNull();
  });
});

describe('CollisionPolygon3D.margin', () => {
  it('accepts the closed hint bounds 0.001 and 10', () => {
    expect(check('margin', '0.001')).toBeNull();
    expect(check('margin', '10')).toBeNull();
  });

  it('accepts the documented default', () => {
    expect(check('margin', '0.04')).toBeNull();
  });

  it('warns rather than errors outside the hint, since set_margin has no clamp or ERR_FAIL', () => {
    // collision_polygon_3d.cpp:228-233 assigns `margin = p_margin` unconditionally.
    // PROPERTY_HINT_RANGE only constrains the inspector slider.
    expect(check('margin', '0')?.severity).toBe('warning');
    expect(check('margin', '10.5')?.severity).toBe('warning');
  });

  it('rejects a non-numeric value', () => {
    expect(check('margin', '"wide"')).not.toBeNull();
  });
});

describe('CollisionPolygon3D.debug_color', () => {
  it('accepts a 4-component Color literal', () => {
    expect(check('debug_color', 'Color(0, 0.6, 0.7, 0.42)')).toBeNull();
  });

  it('accepts the placeholder default the class reference documents', () => {
    expect(check('debug_color', 'Color(0, 0, 0, 0)')).toBeNull();
  });

  it('rejects a 3-component Color literal', () => {
    // VariantParser::parse_value refuses a Color with an argument count != 4
    // (variant_parser.cpp:913), so the previewer's format check must too.
    expect(check('debug_color', 'Color(0, 0, 0)')).not.toBeNull();
  });

  it('rejects a non-Color value', () => {
    expect(check('debug_color', '"red"')).not.toBeNull();
  });
});

describe('CollisionPolygon3D.debug_fill', () => {
  it('accepts true and false', () => {
    expect(check('debug_fill', 'true')).toBeNull();
    expect(check('debug_fill', 'false')).toBeNull();
  });

  it('rejects anything else', () => {
    expect(check('debug_fill', 'yes')).not.toBeNull();
  });
});

describe('CollisionPolygon3D inherits Node3D properties', () => {
  it("applies Node3D's transform bound rather than accepting anything", () => {
    expect(check('transform', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)')).toBeNull();
    expect(check('transform', 'not-a-transform')).not.toBeNull();
  });

  it("applies Node3D's boolean rule for visible", () => {
    expect(check('visible', 'true')).toBeNull();
    expect(check('visible', 'sort-of')).not.toBeNull();
  });
});
