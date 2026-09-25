/**
 * MeshInstance2D strict validators: format and range checks, asserted through
 * `validatorRegistry` so a failure points at the validator, not at scene parsing.
 * Each numeric bound quotes its governing Godot source line.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('MeshInstance2D', property);
  expect(validator, `no validator registered for MeshInstance2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys MeshInstance2D binds: the two ADD_PROPERTY calls at
 * mesh_instance_2d.cpp:64-65, the only members doc/classes/MeshInstance2D.xml lists,
 * with no other route in mesh_instance_2d.cpp or .h. Set this or DECLARES_NOTHING:
 * leaving both unset fails on purpose.
 */
const KEYS: string[] = ['mesh', 'texture'];
/** True only when the class binds no ADD_PROPERTY, with the source line that proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys MeshInstance2D does not declare, each paired with the ancestor that does.
 * The malformed-value check iterates `getOwnKeys`, so it passes vacuously on a
 * class that declares nothing. Resolving a key to the ancestor's own validator
 * tells "declares nothing" apart from "not written yet".
 */
const INHERITED: [owner: string, key: string][] = [
  ['Node2D', 'position'],
  ['Node2D', 'rotation'],
];

describe('MeshInstance2D strict validators', () => {
  it('registers exactly what MeshInstance2D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('MeshInstance2D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run against what this
    // test imported. `fixtureLint` owns the whole-registry version through the barrel.
    expectFixtureClean('unit-mesh-instance-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. This check is
    // vacuous when MeshInstance2D declares nothing, which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('MeshInstance2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key MeshInstance2D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // MeshInstance2D would answer here and could disagree with the ancestor.
      expect(validatorRegistry.findValidator('MeshInstance2D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('MeshInstance2D')).not.toContain(key);
    }
  });

  describe('mesh', () => {
    it('accepts a SubResource reference', () => {
      expect(check('mesh', 'SubResource("QuadMesh_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('mesh', 'ExtResource("1")')).toBeNull();
    });

    it('rejects a bare resource path string', () => {
      expect(check('mesh', '"res://quad.tres"')?.code).toBe('INVALID_MESH_REFERENCE');
    });

    it('accepts the literal null, a cleared slot Godot loads', () => {
      // The writer omits a cleared slot, but the loader takes a hand-written `null`
      // (variant_parser.cpp:699, NIL -> OBJECT at variant.cpp:543).
      expect(check('mesh', 'null')).toBeNull();
    });
  });

  describe('texture', () => {
    it('accepts a SubResource reference', () => {
      expect(check('texture', 'SubResource("GradientTexture2D_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('texture', 'ExtResource("2")')).toBeNull();
    });

    it('rejects a bare resource path string', () => {
      expect(check('texture', '"res://marker.png"')?.code).toBe('INVALID_TEXTURE_REFERENCE');
    });

    it('accepts the literal null, a cleared slot Godot loads', () => {
      // The writer omits a cleared slot, but the loader takes a hand-written `null`
      // (variant_parser.cpp:699, NIL -> OBJECT at variant.cpp:543).
      expect(check('texture', 'null')).toBeNull();
    });
  });
});
