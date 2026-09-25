/**
 * GPUParticlesCollisionSphere3D strict validators, asserted through `validatorRegistry` so a
 * failure points at the validator rather than at scene parsing. Rule-level
 * behaviour belongs in linter.test.ts. Quote the governing Godot source line
 * beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GPUParticlesCollisionSphere3D', property);
  expect(validator, `no validator registered for GPUParticlesCollisionSphere3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('GPUParticlesCollisionSphere3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('GPUParticlesCollisionSphere3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format.
    const accepted = validatorRegistry
      .getOwnKeys('GPUParticlesCollisionSphere3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('radius', () => {
    it('accepts the documented default', () => {
      expect(check('radius', '1.0')).toBeNull();
    });

    it('accepts the value right at the hard floor', () => {
      expect(check('radius', '0.01')).toBeNull();
    });

    it('accepts a value far past the soft slider ceiling, since or_greater lifts it', () => {
      // gpu_particles_collision_3d.cpp:71: "0.01,1024,0.01,or_greater,suffix:m" -
      // or_greater means 1024 is a slider-only bound, not a hard cap.
      expect(check('radius', '4096')).toBeNull();
    });

    it('rejects a non-numeric value with a format error', () => {
      const error = check('radius', 'not-a-number');
      expect(error?.code).toBe('INVALID_RADIUS_FORMAT');
    });

    it('rejects a value below the hard floor with a value error', () => {
      const error = check('radius', '0.005');
      expect(error?.code).toBe('INVALID_RADIUS_VALUE');
    });

    it('rejects a negative value with a value error', () => {
      const error = check('radius', '-1');
      expect(error?.code).toBe('INVALID_RADIUS_VALUE');
    });
  });

  it('resolves an inherited GPUParticlesCollision3D key through the base-walk', () => {
    // Proves the shared-tier import above is wired: `cull_mask` is declared on
    // GPUParticlesCollision3D, not on this type, so it must resolve through
    // NODE_BASE_TYPES rather than getOwnKeys.
    const validator = validatorRegistry.findValidator('GPUParticlesCollisionSphere3D', 'cull_mask');
    expect(validator).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('GPUParticlesCollisionSphere3D')).not.toContain('cull_mask');
  });
});
