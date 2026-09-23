/**
 * GPUParticlesAttractorVectorField3D strict validators, asserted through `validatorRegistry` so a
 * failure points at the validator rather than at scene parsing. Rule-level
 * behaviour belongs in linter.test.ts. Quote the governing Godot source line
 * beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GPUParticlesAttractorVectorField3D', property);
  expect(validator, `no validator registered for GPUParticlesAttractorVectorField3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('GPUParticlesAttractorVectorField3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('GPUParticlesAttractorVectorField3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format.
    const accepted = validatorRegistry
      .getOwnKeys('GPUParticlesAttractorVectorField3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('size', () => {
    it('accepts a Vector3 at the documented default', () => {
      expect(check('size', 'Vector3(2, 2, 2)')).toBeNull();
    });

    it('accepts a Vector3 right at the hard floor on every component', () => {
      expect(check('size', 'Vector3(0.01, 0.01, 0.01)')).toBeNull();
    });

    it('accepts a component far past the soft slider ceiling, since or_greater lifts it', () => {
      // gpu_particles_collision_3d.cpp:1003: "0.01,1024,0.01,or_greater,suffix:m" -
      // or_greater means 1024 is a slider-only bound, not a hard cap.
      expect(check('size', 'Vector3(4096, 2, 2)')).toBeNull();
    });

    it('rejects a non-Vector3 value with a format error', () => {
      const error = check('size', 'not-a-vector3');
      expect(error?.code).toBe('INVALID_SIZE_FORMAT');
    });

    it('rejects a component below the hard floor with a value error', () => {
      const error = check('size', 'Vector3(0, 2, 2)');
      expect(error?.code).toBe('INVALID_SIZE_VALUE');
    });

    it('rejects a negative component with a value error', () => {
      const error = check('size', 'Vector3(2, -1, 2)');
      expect(error?.code).toBe('INVALID_SIZE_VALUE');
    });
  });

  describe('texture', () => {
    it('accepts a SubResource reference', () => {
      expect(check('texture', 'SubResource("PlaceholderTexture3D_1")')).toBeNull();
    });

    it('accepts an ExtResource reference', () => {
      expect(check('texture', 'ExtResource("1_texture")')).toBeNull();
    });

    it('rejects a bare string with a reference format error', () => {
      const error = check('texture', 'not-a-reference');
      expect(error?.code).toBe('INVALID_TEXTURE_REFERENCE');
    });
  });

  it('resolves an inherited GPUParticlesAttractor3D key through the base-walk', () => {
    // Proves the shared-tier import above is wired: `strength` is declared on
    // GPUParticlesAttractor3D, not on this type, so it must resolve through
    // NODE_BASE_TYPES rather than getOwnKeys.
    const validator = validatorRegistry.findValidator('GPUParticlesAttractorVectorField3D', 'strength');
    expect(validator).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('GPUParticlesAttractorVectorField3D')).not.toContain('strength');
  });
});
