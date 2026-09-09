/**
 * CollisionShape3D strict validators.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator rather
 * than at scene parsing. Rule-level behaviour lives in linter.test.ts.
 *
 * This file did not exist while the slice did — which is how `debug_fill` came
 * to be bound by Godot (`collision_shape_3d.cpp:186`) and registered by nobody,
 * silently accepting any value.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('CollisionShape3D', property);
  expect(validator, `no validator registered for CollisionShape3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

/**
 * Every key CollisionShape3D binds: `shape` (collision_shape_3d.cpp:174-175),
 * `disabled`, `debug_color` (:182) and `debug_fill` (:186). The class binds no
 * `PropertyListHelper`, no `ADD_ARRAY_COUNT` and no property-list override.
 */
const KEYS: string[] = ['shape', 'disabled', 'debug_color', 'debug_fill'];

describe('CollisionShape3D strict validators', () => {
  it('registers exactly what CollisionShape3D binds', () => {
    expect(validatorRegistry.getOwnKeys('CollisionShape3D').sort()).toEqual([...KEYS].sort());
  });

  it('rejects a malformed value on every property it validates', () => {
    const accepted = validatorRegistry
      .getOwnKeys('CollisionShape3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('debug_fill', () => {
    it('accepts both booleans', () => {
      // collision_shape_3d.cpp:186 is a plain Variant::BOOL with no hint, and
      // set_debug_fill_enabled (:352-361) assigns past a redundant-set guard.
      expect(check('debug_fill', 'true')).toBeNull();
      expect(check('debug_fill', 'false')).toBeNull();
    });

    it('rejects a non-boolean', () => {
      expect(check('debug_fill', '1')).not.toBeNull();
      expect(check('debug_fill', '"on"')).not.toBeNull();
    });
  });

  describe('debug_color', () => {
    it('accepts the Color literal Godot writes', () => {
      expect(check('debug_color', 'Color(0, 0.6, 0.7, 0.42)')).toBeNull();
    });

    it('rejects a non-Color value', () => {
      expect(check('debug_color', '"red"')).not.toBeNull();
    });
  });

  describe('disabled and shape', () => {
    it('takes a boolean for disabled', () => {
      expect(check('disabled', 'true')).toBeNull();
      expect(check('disabled', 'yes')).not.toBeNull();
    });

    it('takes a resource reference for shape', () => {
      expect(check('shape', 'SubResource("BoxShape3D_1")')).toBeNull();
      expect(check('shape', 'ExtResource("2_abc")')).toBeNull();
      expect(check('shape', '"BoxShape3D"')).not.toBeNull();
    });
  });

  describe('base-walk inheritance', () => {
    it('resolves a Node3D key without re-declaring it', () => {
      expect(validatorRegistry.findValidator('CollisionShape3D', 'transform')).not.toBeNull();
      expect(validatorRegistry.getOwnKeys('CollisionShape3D')).not.toContain('transform');
    });
  });
});
