/**
 * MultiMeshInstance2D strict validators: format and range checks, asserted
 * through `validatorRegistry` so a failure points at the validator, not at scene
 * parsing. Each numeric bound quotes its governing Godot source line.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import { expectFixtureClean } from '../../../linter/testing/fixtureCheck';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('MultiMeshInstance2D', property);
  expect(validator, `no validator registered for MultiMeshInstance2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys MultiMeshInstance2D binds: the two ADD_PROPERTY calls at
 * multimesh_instance_2d.cpp:80-81, the only members doc/classes/MultiMeshInstance2D.xml
 * lists, with no other route in multimesh_instance_2d.cpp or .h. Set this or
 * DECLARES_NOTHING: leaving both unset fails on purpose.
 */
const KEYS: string[] = ['multimesh', 'texture'];
/** True only when the class binds no ADD_PROPERTY, with the source line that proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys MultiMeshInstance2D does not declare, each paired with the ancestor that
 * does. The malformed-value check iterates `getOwnKeys`, so it passes vacuously on
 * a class that declares nothing. Resolving a key to the ancestor's own validator
 * tells "declares nothing" apart from "not written yet".
 */
const INHERITED: [owner: string, key: string][] = [
  ['Node2D', 'position'],
  ['Node2D', 'rotation'],
];

describe('MultiMeshInstance2D strict validators', () => {
  it('registers exactly what MultiMeshInstance2D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('MultiMeshInstance2D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, run against what this
    // test imported. `fixtureLint` owns the whole-registry version through the barrel.
    expectFixtureClean('unit-multi-mesh-instance-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose validates no format. This check is
    // vacuous when MultiMeshInstance2D declares nothing, which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('MultiMeshInstance2D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key MultiMeshInstance2D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // MultiMeshInstance2D would answer here and could disagree with the ancestor.
      expect(validatorRegistry.findValidator('MultiMeshInstance2D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('MultiMeshInstance2D')).not.toContain(key);
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
      expect(check('multimesh', '"res://grass.tres"')?.code).toBe('INVALID_MULTIMESH_REFERENCE');
    });

    it('accepts the literal null, a cleared slot Godot loads', () => {
      // The writer omits a cleared slot, but the loader takes a hand-written `null`
      // (variant_parser.cpp:699, NIL -> OBJECT at variant.cpp:543).
      expect(check('multimesh', 'null')).toBeNull();
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
