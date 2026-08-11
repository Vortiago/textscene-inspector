/**
 * MultiMeshInstance3D strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('MultiMeshInstance3D', property);
  expect(validator, `no validator registered for MultiMeshInstance3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * MultiMeshInstance3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 *
 * scene/3d/multimesh_instance_3d.cpp:57 — the ONLY ADD_PROPERTY in
 * MultiMeshInstance3D::_bind_methods, and the only member doc/classes/MultiMeshInstance3D.xml
 * lists. No PropertyListHelper/register_property, no ADD_ARRAY_COUNT, no `_set`/`_get`/
 * `get_property_list` override anywhere in multimesh_instance_3d.cpp or .h.
 */
const KEYS: string[] = ['multimesh'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys MultiMeshInstance3D does NOT declare, each paired with the ancestor that does.
 * Name at least one; GeometryInstance3D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives MultiMeshInstance3D no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
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
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-multi-mesh-instance-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // MultiMeshInstance3D declares nothing, which is what INHERITED below covers.
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
      // The SAME function, not merely some validator: a shadowing copy on
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
      // Omitting a cleared slot is what the WRITER does; the loader still
      // takes a hand-written `null` (variant_parser.cpp:699, NIL -> OBJECT at
      // variant.cpp:543), so reporting it would flag a file Godot opens.
      expect(check('multimesh', 'null')).toBeNull();
    });
  });
});
