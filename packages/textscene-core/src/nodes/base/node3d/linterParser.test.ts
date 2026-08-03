/**
 * Node3D transform format checks.
 *
 * `transform` is the widest-reaching key in the repo: it is declared on the
 * Node3D tier, so the base-walk delivers it to every spatial node. Its only
 * coverage used to be `scenes/fixtures/edge-invalid-transform.tscn`, a whole
 * scene file whose job was to make the linter emit one error. This asserts the
 * validator directly, which is faster and says what is actually being checked.
 *
 * Driven through `./linterParser` rather than `Linter` so a failure points at
 * the validator instead of at scene parsing.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string, nodeType = 'Node3D') {
  const validator = validatorRegistry.findValidator(nodeType, property);
  expect(validator, `no validator registered for ${nodeType}.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('Node3D transform validators', () => {
  describe('transform', () => {
    it('accepts the identity basis Godot writes', () => {
      expect(check('transform', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)')).toBeNull();
    });

    it('accepts negative and fractional components', () => {
      expect(
        check('transform', 'Transform3D(-1, 0, 0, 0, 0.5, 0, 0, 0, 1, 2.5, -3, 0.125)')
      ).toBeNull();
    });

    it('rejects non-numeric components', () => {
      // The shape the deleted edge-invalid-transform.tscn fixture carried.
      const error = check('transform', 'Transform3D(invalid, values, here)');
      expect(error).not.toBeNull();
      expect(error?.code).toBe('INVALID_TRANSFORM_FORMAT');
      expect(error?.severity).toBe('error');
    });

    it('rejects a component count other than twelve', () => {
      expect(check('transform', 'Transform3D(1, 0, 0)')).not.toBeNull();
      expect(
        check('transform', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 9)')
      ).not.toBeNull();
    });

    it('rejects a value that is not a Transform3D at all', () => {
      expect(check('transform', 'Vector3(1, 2, 3)')).not.toBeNull();
      expect(check('transform', '"a string"')).not.toBeNull();
    });
  });

  describe('global_transform', () => {
    it('is validated the same way', () => {
      expect(
        check('global_transform', 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)')
      ).toBeNull();
      expect(check('global_transform', 'Transform3D(nope)')?.code).toBe(
        'INVALID_GLOBAL_TRANSFORM_FORMAT'
      );
    });
  });

  it('reaches every spatial subclass through the base-walk', () => {
    // The reason this key matters: one validator covers all of Node3D's
    // descendants, so a regression here is a regression everywhere.
    for (const type of ['Camera3D', 'MeshInstance3D', 'RigidBody3D', 'OmniLight3D']) {
      expect(check('transform', 'Transform3D(invalid)', type)).not.toBeNull();
    }
  });
});
