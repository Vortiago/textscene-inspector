/**
 * GPUParticlesCollisionBox3D strict validators, asserted through `validatorRegistry` so a
 * failure points at the validator rather than at scene parsing. Rule-level
 * behaviour belongs in linter.test.ts. Quote the governing Godot source line
 * beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GPUParticlesCollisionBox3D', property);
  expect(validator, `no validator registered for GPUParticlesCollisionBox3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('GPUParticlesCollisionBox3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('GPUParticlesCollisionBox3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format.
    const accepted = validatorRegistry
      .getOwnKeys('GPUParticlesCollisionBox3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('size', () => {
    it('accepts the Godot default', () => {
      expect(check('size', 'Vector3(2, 2, 2)')).toBeNull();
    });

    it('accepts the hard floor exactly', () => {
      // gpu_particles_collision_3d.cpp:101: min 0.01, no `or_less`, so this is a hard bound.
      expect(check('size', 'Vector3(0.01, 0.01, 0.01)')).toBeNull();
    });

    it('accepts well above the stated max, since `or_greater` softens it', () => {
      // gpu_particles_collision_3d.cpp:101: max 1024 carries `or_greater`, so it is not a cap.
      expect(check('size', 'Vector3(2000, 2000, 2000)')).toBeNull();
    });

    it('rejects a non-Vector3 value', () => {
      const error = check('size', 'not-a-vector');
      expect(error?.code).toBe('INVALID_SIZE_FORMAT');
    });

    it('rejects a component below the hard floor', () => {
      const error = check('size', 'Vector3(0.005, 2, 2)');
      expect(error?.code).toBe('INVALID_SIZE_VALUE');
    });

    it('rejects a negative component', () => {
      const error = check('size', 'Vector3(2, -1, 2)');
      expect(error?.code).toBe('INVALID_SIZE_VALUE');
    });
  });

  it("delivers the inherited cull_mask through the base-walk, proving the tier import is wired", () => {
    const validator = validatorRegistry.findValidator('GPUParticlesCollisionBox3D', 'cull_mask');
    expect(validator).not.toBeNull();
    expect(validator!('cull_mask', 'not-a-number', 1)?.code).toBeTruthy();
    expect(validator!('cull_mask', '4294967295', 1)).toBeNull();
  });
});
