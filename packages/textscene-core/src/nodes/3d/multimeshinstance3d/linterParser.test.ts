/**
 * MultiMeshInstance3D strict validators, asserted through `validatorRegistry` so a
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
  const validator = validatorRegistry.findValidator('MultiMeshInstance3D', property);
  expect(validator, `no validator registered for MultiMeshInstance3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys MultiMeshInstance3D binds: scene/3d/multimesh_instance_3d.cpp:57 is its one
 * ADD_PROPERTY and doc/classes/MultiMeshInstance3D.xml's one member, and
 * multimesh_instance_3d.cpp has no other route. Set this or
 * DECLARES_NOTHING: both unset fails on purpose. Never delete an assertion to pass.
 */
const KEYS: string[] = ['multimesh'];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * At least one key MultiMeshInstance3D inherits, with the ancestor that declares it.
 * The malformed-value sweep iterates `getOwnKeys`, so it passes vacuously on a
 * class that declares nothing. Resolving a key to the ancestor's own validator
 * tells "declares nothing" apart from "not written yet".
 */
const INHERITED: [owner: string, key: string][] = [
  ['GeometryInstance3D', 'cast_shadow'],
  ['GeometryInstance3D', 'transparency'],
  ['GeometryInstance3D', 'lod_bias'],
  ['GeometryInstance3D', 'gi_mode'],
  ['GeometryInstance3D', 'visibility_range_begin'],
];

describe('MultiMeshInstance3D strict validators', () => {
  it('registers exactly what MultiMeshInstance3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('MultiMeshInstance3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // Runs the fixture's zero-diagnostic claim against what this test imports.
    // `fixtureLint` covers the whole registry but needs the barrel.
    expectFixtureClean('unit-multi-mesh-instance-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. Vacuous
    // when MultiMeshInstance3D declares nothing, which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('MultiMeshInstance3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key MultiMeshInstance3D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // MultiMeshInstance3D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('MultiMeshInstance3D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('MultiMeshInstance3D')).not.toContain(key);
    }
  });

  describe('multimesh', () => {
    it('accepts a SubResource reference', () => {
      expect(check('multimesh', 'SubResource("MultiMesh_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('multimesh', 'ExtResource("1")')).toBeNull();
    });

    it('rejects a bare resource path string', () => {
      expect(check('multimesh', '"res://grass.tres"')).not.toBeNull();
    });

    it('accepts the literal null, a cleared slot Godot loads', () => {
      // The writer omits a cleared slot, but the loader takes a hand-written `null`
      // (variant_parser.cpp:699, NIL -> OBJECT at variant.cpp:543).
      expect(check('multimesh', 'null')).toBeNull();
    });
  });
});
