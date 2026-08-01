/**
 * GPUParticlesAttractorSphere3D strict validators — format and range checks.
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
  const validator = validatorRegistry.findValidator('GPUParticlesAttractorSphere3D', property);
  expect(validator, `no validator registered for GPUParticlesAttractorSphere3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('GPUParticlesAttractorSphere3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('GPUParticlesAttractorSphere3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('GPUParticlesAttractorSphere3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('radius', () => {
    // gpu_particles_collision_3d.cpp:922, "0.01,1024,0.01,or_greater,suffix:m":
    // 0.01 is the hard floor (no `or_less`); 1024 is a soft slider max only
    // (`or_greater`), so nothing above it is rejected.
    it('accepts the class default (1.0)', () => {
      expect(check('radius', '1.0')).toBeNull();
    });

    it('accepts the hard floor exactly (0.01)', () => {
      expect(check('radius', '0.01')).toBeNull();
    });

    it('accepts a value far past the soft slider max, since or_greater lifts it', () => {
      expect(check('radius', '5000')).toBeNull();
    });

    it('rejects a non-numeric value with a format error', () => {
      expect(check('radius', 'not-a-number')?.code).toBe('INVALID_RADIUS_FORMAT');
    });

    it('rejects a value below the hard floor with a value error', () => {
      expect(check('radius', '0.009')?.code).toBe('INVALID_RADIUS_VALUE');
    });

    it('rejects zero, below the hard floor', () => {
      expect(check('radius', '0')?.code).toBe('INVALID_RADIUS_VALUE');
    });

    it('rejects a negative radius', () => {
      expect(check('radius', '-1')?.code).toBe('INVALID_RADIUS_VALUE');
    });
  });

  it('resolves an inherited GPUParticlesAttractor3D key through the base-walk', () => {
    // Proves the shared tier is actually imported, not just that this slice's
    // own `radius` validator works.
    const validator = validatorRegistry.findValidator('GPUParticlesAttractorSphere3D', 'strength');
    expect(validator, 'strength should resolve via GPUParticlesAttractor3D base-walk').not.toBeNull();
    expect(validator!('strength', '-2.5', 1)).toBeNull();
    expect(validator!('strength', 'not-a-number', 1)?.code).toBe('INVALID_STRENGTH_FORMAT');
  });
});
