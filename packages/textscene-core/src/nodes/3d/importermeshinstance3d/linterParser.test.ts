/**
 * ImporterMeshInstance3D strict validators, asserted through `validatorRegistry`
 * so a failure points at the validator, not at scene parsing. One case per
 * property (happy, malformed, any bound), with the Godot line beside each bound.
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
 * Set exactly one, from the source: the keys ImporterMeshInstance3D binds, or
 * DECLARES_NOTHING when it binds no ADD_PROPERTY. Both unset is red on purpose.
 */
const KEYS: string[] = [
  // The ADD_PROPERTY calls at importer_mesh_instance_3d.cpp:164-176, in source
  // order. The class inherits plain Node3D, so each is its own declaration.
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
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys ImporterMeshInstance3D does not declare, each with the ancestor that does.
 * The malformed-value loop iterates `getOwnKeys`, so on a class that declares
 * nothing it passes vacuously. Resolving a key to the ancestor's validator does
 * not, so this is red until filled.
 */
const INHERITED: [owner: string, key: string][] = [
  // node_3d.cpp: a format-only transform validator.
  ['Node3D', 'transform'],
  // node_3d.cpp: a bare boolean assignment.
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
    // `fixtureLint` checks the whole registry but needs the barrel. This checks
    // the same file against what this test imported.
    expectFixtureClean('unit-importer-mesh-instance-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose checks no format. Vacuous when
    // the class declares nothing, which INHERITED covers.
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
      // The same function, not merely some validator: a shadowing copy would
      // answer here while its rule differs from the ancestor's.
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
    it('accepts a negative value — set_layer_mask reads the uint32 straight through', () => {
      expect(check('layer_mask', '-1')).toBeNull();
      expect(check('layer_mask', '4294967296')?.severity).toBe('error');
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
