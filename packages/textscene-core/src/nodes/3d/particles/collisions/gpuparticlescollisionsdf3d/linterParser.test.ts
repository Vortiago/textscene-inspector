/**
 * GPUParticlesCollisionSDF3D strict validators: format and range checks.
 *
 * Asserted through `validatorRegistry` rather than by linting a `.tscn`: the
 * unit under test is the validator, so a failure points at the validator
 * instead of at scene parsing, and no fixture text has to be maintained
 * alongside it. Rule-level behaviour belongs in linter.test.ts, through `Linter`.
 *
 * Grow this into one case per property (happy, malformed, and any bound) and
 * quote the governing Godot source line beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GPUParticlesCollisionSDF3D', property);
  expect(validator, `no validator registered for GPUParticlesCollisionSDF3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('GPUParticlesCollisionSDF3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('GPUParticlesCollisionSDF3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format. The
    // sweep is generic on purpose; per-property cases come next.
    const accepted = validatorRegistry
      .getOwnKeys('GPUParticlesCollisionSDF3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('size', () => {
    it('accepts the Godot default', () => {
      expect(check('size', 'Vector3(2, 2, 2)')).toBeNull();
    });

    it('accepts the hard floor exactly', () => {
      // gpu_particles_collision_3d.cpp:554, min 0.01, no `or_less`, so this is a hard bound.
      expect(check('size', 'Vector3(0.01, 0.01, 0.01)')).toBeNull();
    });

    it('accepts well above the stated max, since `or_greater` softens it', () => {
      // gpu_particles_collision_3d.cpp:554, max 1024 carries `or_greater`, so it is not a cap.
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
  });

  describe('resolution', () => {
    it('accepts the Godot default (index 2 = 64)', () => {
      expect(check('resolution', '2')).toBeNull();
    });

    it('accepts the lowest index', () => {
      expect(check('resolution', '0')).toBeNull();
    });

    it('accepts the real upper bound of the enum (index 5 = 512), not the literal 512', () => {
      // gpu_particles_collision_3d.cpp:555 hints PROPERTY_HINT_ENUM "16,32,64,128,256,512":
      // 6 entries, so the stored value is the INDEX 0-5, never the texel count itself.
      expect(check('resolution', '5')).toBeNull();
    });

    it('rejects the literal resolution value 512, which is not a legal index', () => {
      const error = check('resolution', '512');
      expect(error?.code).toBe('INVALID_RESOLUTION_VALUE');
    });

    it('rejects index 6 (RESOLUTION_MAX), which is a sizing sentinel absent from the hint enum', () => {
      const error = check('resolution', '6');
      expect(error?.code).toBe('INVALID_RESOLUTION_VALUE');
    });

    it('rejects a non-integer value', () => {
      const error = check('resolution', 'not-a-number');
      expect(error?.code).toBe('INVALID_RESOLUTION_FORMAT');
    });
  });

  describe('thickness', () => {
    it('accepts the Godot default', () => {
      expect(check('thickness', '1.0')).toBeNull();
    });

    it('accepts the hard floor exactly', () => {
      // gpu_particles_collision_3d.cpp:556, "0.0,2.0,0.01,suffix:m", no `or_greater`/`or_less`.
      expect(check('thickness', '0.0')).toBeNull();
    });

    it('accepts the hard ceiling exactly', () => {
      expect(check('thickness', '2.0')).toBeNull();
    });

    it('rejects above the hard ceiling, since the absence of `or_greater` makes 2.0 a real cap', () => {
      const error = check('thickness', '2.5');
      expect(error?.code).toBe('INVALID_THICKNESS_VALUE');
    });

    it('rejects a negative value', () => {
      const error = check('thickness', '-0.1');
      expect(error?.code).toBe('INVALID_THICKNESS_VALUE');
    });

    it('rejects a non-numeric value', () => {
      const error = check('thickness', 'not-a-number');
      expect(error?.code).toBe('INVALID_THICKNESS_FORMAT');
    });
  });

  describe('bake_mask', () => {
    it('accepts the Godot default (all 32 bits)', () => {
      // gpu_particles_collision_3d.cpp:557, PROPERTY_HINT_LAYERS_3D_RENDER.
      expect(check('bake_mask', '4294967295')).toBeNull();
    });

    it('accepts zero (no layers)', () => {
      expect(check('bake_mask', '0')).toBeNull();
    });

    it('rejects a negative value', () => {
      const error = check('bake_mask', '-1');
      expect(error?.code).toBe('INVALID_BAKE_MASK_VALUE');
    });

    it('rejects a non-numeric value', () => {
      const error = check('bake_mask', 'not-a-number');
      expect(error?.code).toBe('INVALID_BAKE_MASK_FORMAT');
    });
  });

  describe('texture', () => {
    it('accepts an ExtResource reference', () => {
      expect(check('texture', 'ExtResource("1_sdf")')).toBeNull();
    });

    it('accepts a SubResource reference', () => {
      expect(check('texture', 'SubResource("Texture3D_1")')).toBeNull();
    });

    it('rejects a bare string', () => {
      const error = check('texture', '"res://baked.exr"');
      expect(error?.code).toBe('INVALID_TEXTURE_REFERENCE');
    });
  });

  it("delivers the inherited cull_mask through the base-walk, proving the tier import is wired", () => {
    const validator = validatorRegistry.findValidator('GPUParticlesCollisionSDF3D', 'cull_mask');
    expect(validator).not.toBeNull();
    expect(validator!('cull_mask', 'not-a-number', 1)?.code).toBeTruthy();
    expect(validator!('cull_mask', '4294967295', 1)).toBeNull();
  });
});
