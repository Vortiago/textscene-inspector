/**
 * VoxelGI strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('VoxelGI', property);
  expect(validator, `no validator registered for VoxelGI.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Set exactly ONE, from the source rather than from expectation: list the keys
 * VoxelGI binds, or set DECLARES_NOTHING when it binds no ADD_PROPERTY at all.
 * Leaving both unset is red on purpose. Do NOT delete an assertion to go green.
 */
// voxel_gi.cpp:570-573 — the four ADD_PROPERTY calls in VoxelGI::_bind_methods.
const KEYS: string[] = ['subdiv', 'size', 'camera_attributes', 'data'];
/** True only when the class binds NO ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * Keys VoxelGI does NOT declare, each paired with the ancestor that does.
 * Name at least one; VisualInstance3D is where to start.
 *
 * This is the assertion the malformed-value sweep below CANNOT make. That sweep
 * iterates `getOwnKeys`, so on a class that rightly declares nothing it sweeps
 * an EMPTY set and passes while asserting nothing — "Godot gives VoxelGI no
 * properties of its own" and "nobody has written this slice yet" look identical
 * to it. Resolving a key through the base-walk to the ancestor's own validator
 * function tells the two apart, and it is red until filled for the same reason
 * KEYS is.
 */
const INHERITED: [owner: string, key: string][] = [
  // visual_instance_3d.cpp:182 — VoxelGI never overrides _validate_property, so
  // this is VisualInstance3D's own rule, not a shadowed copy.
  ['VisualInstance3D', 'layers'],
  // node3d/linterParser.ts — Node3D's own `visible`.
  ['Node3D', 'visible'],
];

describe('VoxelGI strict validators', () => {
  it('registers exactly what VoxelGI binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('VoxelGI').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // The fixture's "zero errors and zero warnings" claim, RUN rather than
    // reasoned. `fixtureLint` owns the whole-registry version but needs the
    // barrel, so it cannot run while sibling slices are being written; this
    // checks the same file against whatever this test imported.
    expectFixtureClean('unit-voxel-gi.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next. Vacuous when
    // VoxelGI declares nothing, which is what INHERITED below covers.
    const accepted = validatorRegistry
      .getOwnKeys('VoxelGI')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key VoxelGI inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The SAME function, not merely some validator: a shadowing copy on
      // VoxelGI would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('VoxelGI', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('VoxelGI')).not.toContain(key);
    }
  });

  describe('subdiv', () => {
    // voxel_gi.cpp:570 PROPERTY_HINT_ENUM "64,128,256,512"; set_subdiv
    // (:285-288) ERR_FAIL_INDEXes against SUBDIV_MAX = 4.
    it('accepts every enum value 0-3', () => {
      expect(check('subdiv', '0')).toBeNull();
      expect(check('subdiv', '1')).toBeNull();
      expect(check('subdiv', '2')).toBeNull();
      expect(check('subdiv', '3')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      expect(check('subdiv', 'high')).not.toBeNull();
    });

    it('rejects 4 (SUBDIV_MAX itself) as an error, refused by ERR_FAIL_INDEX', () => {
      const result = check('subdiv', '4');
      expect(result).not.toBeNull();
      expect(result?.severity).toBe('error');
    });

    it('rejects a negative index as an error', () => {
      const result = check('subdiv', '-1');
      expect(result).not.toBeNull();
      expect(result?.severity).toBe('error');
    });
  });

  describe('size', () => {
    // voxel_gi.cpp:571 PROPERTY_HINT_NONE; set_size (:295-298) clamps every
    // component up to 1.0 via Vector3::maxf.
    it('accepts every component at or above the 1.0 floor', () => {
      expect(check('size', 'Vector3(20, 20, 20)')).toBeNull();
      expect(check('size', 'Vector3(1, 1, 1)')).toBeNull();
      expect(check('size', 'Vector3(1000, 1, 500)')).toBeNull();
    });

    it('rejects a malformed literal', () => {
      expect(check('size', 'not-a-vector')).not.toBeNull();
    });

    it('flags a component below 1.0 as an error — set_size alters rather than refuses it', () => {
      const result = check('size', 'Vector3(0.5, 20, 20)');
      expect(result).not.toBeNull();
      expect(result?.severity).toBe('error');
    });

    it('accepts +inf on a component — maxf(inf, 1.0) leaves it unchanged', () => {
      expect(check('size', 'Vector3(inf, 20, 20)')).toBeNull();
    });
  });

  describe('camera_attributes', () => {
    // voxel_gi.cpp:572 PROPERTY_HINT_RESOURCE_TYPE; format only.
    it('accepts a SubResource reference', () => {
      expect(check('camera_attributes', 'SubResource("CameraAttributesPractical_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('camera_attributes', 'ExtResource("1_cam_attr")')).toBeNull();
    });

    it('rejects a bare identifier', () => {
      expect(check('camera_attributes', 'not_a_reference')).not.toBeNull();
    });
  });

  describe('data', () => {
    // voxel_gi.cpp:573 PROPERTY_HINT_RESOURCE_TYPE "VoxelGIData"; format only.
    it('accepts a SubResource reference', () => {
      expect(check('data', 'SubResource("VoxelGIData_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('data', 'ExtResource("1_data")')).toBeNull();
    });

    it('rejects a bare identifier', () => {
      expect(check('data', 'not_a_reference')).not.toBeNull();
    });
  });
});
