/**
 * Node3D transform format checks.
 *
 * `transform` is the widest-reaching key in the repo: it is declared on the
 * Node3D tier, so the base-walk delivers it to every spatial node. Its only
 * coverage is this file, asserting the validator directly rather than through a
 * whole scene whose job is to make the linter emit one error — faster, and it
 * says what is actually being checked.
 *
 * Driven through `./linterParser` rather than `Linter` so a failure points at
 * the validator instead of at scene parsing.
 */

import { describe, expect, it } from 'vitest';
import { checkerFor, expectError, expectWarning } from '../../../linter/testing/validatorCheck';
import './linterParser';

/** `Node3D.<property>`'s registered validator; `nodeType` re-aims it at a subclass. */
function check(property: string, value: string, nodeType = 'Node3D') {
  return checkerFor(nodeType)(property, value);
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
      const error = expectError(check('transform', 'Transform3D(invalid, values, here)'), 'Transform3D');
      expect(error.code).toBe('INVALID_TRANSFORM_FORMAT');
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

  describe('rotation_edit_mode', () => {
    // node_3d.cpp:1532 — PROPERTY_HINT_ENUM "Euler,Quaternion,Basis". Three
    // BIND_ENUM_CONSTANT entries (node_3d.cpp:1519-1521) put the legal span at
    // 0-2, not the label-list length by coincidence.
    it('accepts 0, 1 and 2 (Euler, Quaternion, Basis)', () => {
      expect(check('rotation_edit_mode', '0')).toBeNull();
      expect(check('rotation_edit_mode', '1')).toBeNull();
      expect(check('rotation_edit_mode', '2')).toBeNull();
    });

    // set_rotation_edit_mode (node_3d.cpp:717-746) has no ERR_FAIL_INDEX at
    // all, unlike its neighbour set_rotation_order (node_3d.cpp:759)'s
    // `ERR_FAIL_INDEX(int32_t(p_order), 6)` — two enums in the same file,
    // adjacent, different tiers. Out of range is a WARNING, not an error.
    it('warns rather than errors outside the enum, unlike rotation_order', () => {
      const below = expectWarning(check('rotation_edit_mode', '-1'), 'must be 0-2');
      const above = expectWarning(check('rotation_edit_mode', '3'), 'must be 0-2');
      // The VALUE code, not just severity, proves the enum-range branch ran.
      expect(below.code).toBe('INVALID_ROTATION_EDIT_MODE_VALUE');
      expect(above.code).toBe('INVALID_ROTATION_EDIT_MODE_VALUE');
    });
  });
});
