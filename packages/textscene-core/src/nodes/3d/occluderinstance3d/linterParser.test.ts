/**
 * OccluderInstance3D strict validators, asserted through `validatorRegistry` so a
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
  const validator = validatorRegistry.findValidator('OccluderInstance3D', property);
  expect(validator, `no validator registered for OccluderInstance3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * The keys OccluderInstance3D binds, read from the source. Set this or DECLARES_NOTHING:
 * both unset fails on purpose. Never delete an assertion to pass.
 */
const KEYS: string[] = ['occluder', 'bake_mask', 'bake_simplification_distance'];
/** True only when the class binds no ADD_PROPERTY. Say which source line proves it. */
const DECLARES_NOTHING = false;

/**
 * At least one key OccluderInstance3D inherits, with the ancestor that declares it.
 * The malformed-value sweep iterates `getOwnKeys`, so it passes vacuously on a
 * class that declares nothing. Resolving a key to the ancestor's own validator
 * tells "declares nothing" apart from "not written yet".
 */
const INHERITED: [owner: string, key: string][] = [
  // visual_instance_3d.cpp:182, PROPERTY_HINT_LAYERS_3D_RENDER: VisualInstance3D's own
  // layer mask, distinct from OccluderInstance3D's `bake_mask`.
  ['VisualInstance3D', 'layers'],
  // node_3d.cpp: a bare boolean assignment. A `Node` key such as `process_mode` does
  // not resolve here: node3d/linterParser.ts does not import node/linterParser.ts, so
  // an isolated slice test registers only Node3D and VisualInstance3D.
  ['Node3D', 'visible'],
];

describe('OccluderInstance3D strict validators', () => {
  it('registers exactly what OccluderInstance3D binds', () => {
    expect(
      DECLARES_NOTHING || KEYS.length > 0,
      'fill KEYS from the ADD_PROPERTY calls, or set DECLARES_NOTHING with the source line that proves it'
    ).toBe(true);
    expect(validatorRegistry.getOwnKeys('OccluderInstance3D').sort()).toEqual([...KEYS].sort());
  });

  it('accepts every value its own fixture carries', () => {
    // Runs the fixture's zero-diagnostic claim against what this test imports.
    // `fixtureLint` covers the whole registry but needs the barrel.
    expectFixtureClean('unit-occluder-instance-3d.tscn');
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. Vacuous
    // when OccluderInstance3D declares nothing, which INHERITED covers.
    const accepted = validatorRegistry
      .getOwnKeys('OccluderInstance3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves each inherited key to the ancestor that declares it', () => {
    expect(
      INHERITED.length,
      'name at least one key OccluderInstance3D inherits, and the ancestor that declares it'
    ).toBeGreaterThan(0);
    for (const [owner, key] of INHERITED) {
      const owned = validatorRegistry.findValidator(owner, key);
      expect(owned, `${owner} does not declare '${key}'`).not.toBeNull();
      // The same function, not merely some validator: a shadowing copy on
      // OccluderInstance3D would answer here while drifting from the ancestor's rule.
      expect(validatorRegistry.findValidator('OccluderInstance3D', key)).toBe(owned);
      expect(validatorRegistry.getOwnKeys('OccluderInstance3D')).not.toContain(key);
    }
  });

  describe('occluder', () => {
    // occluder_instance_3d.cpp:434-461: set_occluder is a bare Ref<> assignment, so
    // only the reference shape is checked.
    it('accepts a SubResource reference', () => {
      expect(check('occluder', 'SubResource("BoxOccluder3D_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('occluder', 'ExtResource("1_occ")')).toBeNull();
    });

    it('rejects a bare identifier', () => {
      expect(check('occluder', 'not_a_resource')).not.toBeNull();
    });
  });

  describe('bake_mask', () => {
    // occluder_instance_3d.cpp:472-475: set_bake_mask is a bare uint32 assignment, so
    // every 32-bit value is legal.
    it('accepts the documented default (4294967295, all layers)', () => {
      expect(check('bake_mask', '4294967295')).toBeNull();
    });

    it('accepts zero (no layers)', () => {
      expect(check('bake_mask', '0')).toBeNull();
    });

    it('accepts a single-bit mask', () => {
      expect(check('bake_mask', '1')).toBeNull();
    });

    it('accepts a negative value — the widget renders that 32-bit pattern', () => {
      // occluder_instance_3d.cpp:746, PROPERTY_HINT_LAYERS_3D_RENDER: the
      // setter takes any uint32_t straight through, and -1 is all bits on.
      expect(check('bake_mask', '-1')).toBeNull();
    });

    it('refuses a value past the 32-bit ceiling, where a bit is dropped', () => {
      const result = check('bake_mask', '4294967296');
      expect(result).not.toBeNull();
      expect(result?.severity).toBe('error');
    });
  });

  describe('bake_simplification_distance', () => {
    it('accepts the documented default (0.1)', () => {
      expect(check('bake_simplification_distance', '0.1')).toBeNull();
    });

    it('accepts the enforced floor (0.0) — disables simplification per the doc', () => {
      expect(check('bake_simplification_distance', '0.0')).toBeNull();
    });

    it('accepts the hinted ceiling (2.0)', () => {
      expect(check('bake_simplification_distance', '2.0')).toBeNull();
    });

    it('rejects a negative value as an ERROR — set_bake_simplification_distance clamps with MAX(p_dist, 0.0f)', () => {
      const result = check('bake_simplification_distance', '-0.5');
      expect(result).not.toBeNull();
      expect(result?.severity).toBe('error');
    });

    it('rejects a value past 2.0 as a WARNING — the hint ceiling has no or_greater but the setter never checks it', () => {
      const result = check('bake_simplification_distance', '2.5');
      expect(result).not.toBeNull();
      expect(result?.severity).toBe('warning');
    });
  });
});
