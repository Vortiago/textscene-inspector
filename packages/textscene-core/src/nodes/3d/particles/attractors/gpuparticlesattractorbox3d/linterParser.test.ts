/**
 * GPUParticlesAttractorBox3D strict validators — format and range checks.
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
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GPUParticlesAttractorBox3D', property);
  expect(validator, `no validator registered for GPUParticlesAttractorBox3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('GPUParticlesAttractorBox3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('GPUParticlesAttractorBox3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('GPUParticlesAttractorBox3D')
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
      // gpu_particles_collision_3d.cpp:952: "0.01,1024,0.01,or_greater,suffix:m" -
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

  it('resolves an inherited GPUParticlesAttractor3D key through the base-walk', () => {
    // Proves the shared-tier import above is wired: `strength` is declared on
    // GPUParticlesAttractor3D, not on this type, so it must resolve through
    // NODE_BASE_TYPES rather than getOwnKeys.
    const validator = validatorRegistry.findValidator('GPUParticlesAttractorBox3D', 'strength');
    expect(validator).not.toBeNull();
    expect(validatorRegistry.getOwnKeys('GPUParticlesAttractorBox3D')).not.toContain('strength');
  });
});
