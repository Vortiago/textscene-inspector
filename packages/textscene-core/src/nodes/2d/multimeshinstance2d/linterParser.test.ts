/**
 * MultiMeshInstance2D strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('MultiMeshInstance2D', property);
  expect(validator, `no validator registered for MultiMeshInstance2D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * MultiMeshInstance2D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 *
 * multimesh_instance_2d.cpp:80-81 — the only two ADD_PROPERTY calls in
 * MultiMeshInstance2D::_bind_methods, and the only members
 * doc/classes/MultiMeshInstance2D.xml lists. No PropertyListHelper/register_property,
 * no ADD_ARRAY_COUNT, no `_set`/`_get`/`get_property_list` override anywhere in
 * multimesh_instance_2d.cpp or .h.
 */
const KEYS: string[] = ['multimesh', 'texture'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys MultiMeshInstance2D does NOT declare, each paired with the ancestor that does.
 * Name at least one; Node2D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives MultiMeshInstance2D no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
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
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-multi-mesh-instance-2d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // MultiMeshInstance2D declares nothing, which is what INHERITED below covers.
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
      // The SAME function, not merely some validator: a shadowing copy on
      // MultiMeshInstance2D would answer here while drifting from the ancestor's rule.
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

    it('rejects the literal null', () => {
      // A bare `Ref<MultiMesh>` that is empty is the property's default and
      // is simply omitted from serialisation rather than written as `null`.
      expect(check('multimesh', 'null')).not.toBeNull();
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

    it('rejects the literal null', () => {
      // Same default-null shape as `multimesh`: Godot omits the key rather
      // than writing `texture = null` at the default.
      expect(check('texture', 'null')).not.toBeNull();
    });
  });
});
