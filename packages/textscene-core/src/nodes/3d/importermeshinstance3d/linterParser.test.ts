/**
 * ImporterMeshInstance3D strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('ImporterMeshInstance3D', property);
  expect(validator, `no validator registered for ImporterMeshInstance3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * ImporterMeshInstance3D binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
const KEYS: string[] = [
  // The 10 ADD_PROPERTY calls at importer_mesh_instance_3d.cpp:164-176, in
  // source order. All 10 XML members carry no `overrides=` — this class
  // inherits plain Node3D, not GeometryInstance3D, so every one of these is
  // its own declaration despite the familiar names.
  'mesh',
  'skin',
  'skeleton_path',
  'layer_mask',
  'cast_shadow',
  'visibility_range_begin',
  'visibility_range_begin_margin',
  'visibility_range_end',
  'visibility_range_end_margin',
  'visibility_range_fade_mode',
];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys ImporterMeshInstance3D does NOT declare, each paired with the ancestor that does.
 * Name at least one; Node3D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives ImporterMeshInstance3D no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [
  // node_3d.cpp — VECTOR3 format-only validator, distinct from this class's own
  // visibility_range_* floats.
  ['Node3D', 'transform'],
  // node_3d.cpp — bare boolean assignment, distinct from this class's own
  // per-instance cast_shadow/layer_mask.
  ['Node3D', 'visible'],
];

describe('ImporterMeshInstance3D strict validators', () => {
  it('registers exactly what ImporterMeshInstance3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('ImporterMeshInstance3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-importer-mesh-instance-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // ImporterMeshInstance3D declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('ImporterMeshInstance3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key ImporterMeshInstance3D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // ImporterMeshInstance3D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('ImporterMeshInstance3D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('ImporterMeshInstance3D')).not.toContain(key);
    }
  });

  describe('mesh', () => {
    it('accepts a SubResource reference', () => {
      expect(check('mesh', 'SubResource("ImporterMesh_1")')).toBeNull();
    });
    it('accepts an ExtResource reference', () => {
      expect(check('mesh', 'ExtResource("1_mesh")')).toBeNull();
    });
    it('rejects a bare identifier', () => {
      expect(check('mesh', 'not_a_resource')).not.toBeNull();
    });
  });

  describe('skin', () => {
    it('accepts a SubResource reference', () => {
      expect(check('skin', 'SubResource("Skin_1")')).toBeNull();
    });
    it('rejects a bare identifier', () => {
      expect(check('skin', 'not_a_resource')).not.toBeNull();
    });
  });

  describe('skeleton_path', () => {
    it('accepts a NodePath literal', () => {
      expect(check('skeleton_path', 'NodePath("../Skeleton3D")')).toBeNull();
    });
    it('rejects a bare identifier', () => {
      expect(check('skeleton_path', 'Skeleton3D')).not.toBeNull();
    });
  });

  describe('layer_mask', () => {
    it('accepts the documented default (1)', () => {
      expect(check('layer_mask', '1')).toBeNull();
    });
    it('accepts the full 32-bit mask', () => {
      expect(check('layer_mask', '4294967295')).toBeNull();
    });
    it('rejects a negative value as a WARNING — set_layer_mask assigns the uint32 straight through', () => {
      const result = check('layer_mask', '-1');
      expect(result).not.toBeNull();
      expect(result?.severity).toBe('warning');
    });
  });

  describe('cast_shadow', () => {
    it('accepts every enum value (0-3)', () => {
      for (const value of ['0', '1', '2', '3']) {
        expect(check('cast_shadow', value)).toBeNull();
      }
    });
    it('rejects a value past the enum as a WARNING — set_cast_shadows_setting is a bare assignment', () => {
      const result = check('cast_shadow', '4');
      expect(result).not.toBeNull();
      expect(result?.severity).toBe('warning');
    });
    it('rejects a non-numeric value', () => {
      expect(check('cast_shadow', 'On')).not.toBeNull();
    });
  });

  describe.each([
    'visibility_range_begin',
    'visibility_range_begin_margin',
    'visibility_range_end',
    'visibility_range_end_margin',
  ])('%s', (prop) => {
    it('accepts the documented default (0.0)', () => {
      expect(check(prop, '0.0')).toBeNull();
    });
    it('accepts a value past the hinted 4096.0 ceiling — the hint opens with or_greater', () => {
      expect(check(prop, '5000.0')).toBeNull();
    });
    it('rejects a negative value as a WARNING — the setter is a bare assignment, only the hint says >= 0', () => {
      const result = check(prop, '-1.0');
      expect(result).not.toBeNull();
      expect(result?.severity).toBe('warning');
    });
    it('rejects a non-numeric value', () => {
      expect(check(prop, 'far')).not.toBeNull();
    });
  });

  describe('visibility_range_fade_mode', () => {
    it('accepts every enum value (0-2)', () => {
      for (const value of ['0', '1', '2']) {
        expect(check('visibility_range_fade_mode', value)).toBeNull();
      }
    });
    it('rejects a value past the enum as a WARNING — set_visibility_range_fade_mode is a bare assignment', () => {
      const result = check('visibility_range_fade_mode', '3');
      expect(result).not.toBeNull();
      expect(result?.severity).toBe('warning');
    });
  });
});
