/**
 * VisibleOnScreenNotifier3D strict validators — format and range checks.
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
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('VisibleOnScreenNotifier3D', property);
  expect(validator, `no validator registered for VisibleOnScreenNotifier3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('VisibleOnScreenNotifier3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('VisibleOnScreenNotifier3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases follow.
    const accepted = validatorRegistry
      .getOwnKeys('VisibleOnScreenNotifier3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  it('resolves layers through the base-walk from VisualInstance3D', () => {
    // VisibleOnScreenNotifier3D declares no `layers` validator of its own — it
    // chains to VisualInstance3D (scene/3d/visual_instance_3d.cpp: ADD_PROPERTY(...,
    // "layers", PROPERTY_HINT_LAYERS_3D_RENDER)) via the NODE_BASE_TYPES base-walk.
    expect(validatorRegistry.getOwnKeys('VisibleOnScreenNotifier3D')).not.toContain('layers');
    expect(check('layers', '3')).toBeNull();
    expect(check('layers', 'not-a-number')).not.toBeNull();
  });

  describe('aabb', () => {
    it('accepts the documented default (AABB(-1, -1, -1, 2, 2, 2))', () => {
      expect(check('aabb', 'AABB(-1, -1, -1, 2, 2, 2)')).toBeNull();
    });

    it('accepts an AABB(x, y, z, w, h, d) literal', () => {
      expect(check('aabb', 'AABB(0, 0, 0, 1, 1, 1)')).toBeNull();
    });

    it('rejects a Vector3 (wrong arity)', () => {
      expect(check('aabb', 'Vector3(1, 1, 1)')).not.toBeNull();
    });
  });
});
