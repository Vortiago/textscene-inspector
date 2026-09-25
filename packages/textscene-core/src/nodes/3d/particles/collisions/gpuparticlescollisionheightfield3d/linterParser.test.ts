/**
 * GPUParticlesCollisionHeightField3D strict validators, asserted through `validatorRegistry` so a
 * failure points at the validator rather than at scene parsing. Rule-level
 * behaviour belongs in linter.test.ts. Quote the governing Godot source line
 * beside every numeric bound.
 */

import { describe, expect, it } from 'vitest';
import { validatorRegistry } from '../../../../../linter/ValidatorRegistry';
import './linterParser';

/** The error a validator returns for a value, or null when it accepts it. */
function check(property: string, value: string) {
  const validator = validatorRegistry.findValidator('GPUParticlesCollisionHeightField3D', property);
  expect(validator, `no validator registered for GPUParticlesCollisionHeightField3D.${property}`).not.toBeNull();
  return validator!(property, value, 1);
}

describe('GPUParticlesCollisionHeightField3D strict validators', () => {
  it('registers validators of its own', () => {
    expect(validatorRegistry.getOwnKeys('GPUParticlesCollisionHeightField3D')).not.toEqual([]);
  });

  it('rejects a malformed value on every property it validates', () => {
    // A validator that accepts arbitrary prose is not validating a format.
    const accepted = validatorRegistry
      .getOwnKeys('GPUParticlesCollisionHeightField3D')
      .filter((property) => check(property, 'definitely-not-a-valid-value') === null);
    expect(accepted).toEqual([]);
  });

  describe('size', () => {
    it('accepts the Godot default', () => {
      expect(check('size', 'Vector3(2, 2, 2)')).toBeNull();
    });

    it('accepts the hard floor exactly', () => {
      // gpu_particles_collision_3d.cpp:733: min 0.01, no `or_less`, so this is a hard bound.
      expect(check('size', 'Vector3(0.01, 0.01, 0.01)')).toBeNull();
    });

    it('accepts well above the stated max, since `or_greater` softens it', () => {
      // gpu_particles_collision_3d.cpp:733: max 1024 carries `or_greater`, so it is not a cap.
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

  describe('resolution', () => {
    it('accepts the Godot default (index 2 = RESOLUTION_1024)', () => {
      expect(check('resolution', '2')).toBeNull();
    });

    it('accepts every index in the 6-entry enum', () => {
      for (const index of [0, 1, 2, 3, 4, 5]) {
        expect(check('resolution', String(index))).toBeNull();
      }
    });

    it('rejects a non-numeric value', () => {
      const error = check('resolution', 'not-a-number');
      expect(error?.code).toBe('INVALID_RESOLUTION_FORMAT');
    });

    it('pins the real upper bound: the hint lists 6 entries (indices 0-5), so 6 is out of range', () => {
      // gpu_particles_collision_3d.cpp:734: the PROPERTY_HINT_ENUM has 6 entries, so the
      // .tscn stores an index 0-5, never a literal resolution such as 1024.
      const error = check('resolution', '6');
      expect(error?.code).toBe('INVALID_RESOLUTION_VALUE');
    });

    it('rejects a negative index', () => {
      const error = check('resolution', '-1');
      expect(error?.code).toBe('INVALID_RESOLUTION_VALUE');
    });

    it('rejects the literal resolution value, since the property stores an index not a pixel size', () => {
      const error = check('resolution', '1024');
      expect(error?.code).toBe('INVALID_RESOLUTION_VALUE');
    });
  });

  describe('update_mode', () => {
    it('accepts the Godot default (0 = UPDATE_MODE_WHEN_MOVED)', () => {
      expect(check('update_mode', '0')).toBeNull();
    });

    it('accepts UPDATE_MODE_ALWAYS', () => {
      expect(check('update_mode', '1')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('update_mode', 'not-a-number');
      expect(error?.code).toBe('INVALID_UPDATE_MODE_FORMAT');
    });

    it('rejects an index past the 2-entry enum', () => {
      // gpu_particles_collision_3d.cpp:735: "When Moved (Fast),Always (Slow)" is 2 entries.
      const error = check('update_mode', '2');
      expect(error?.code).toBe('INVALID_UPDATE_MODE_VALUE');
    });
  });

  describe('follow_camera_enabled', () => {
    it('accepts true', () => {
      expect(check('follow_camera_enabled', 'true')).toBeNull();
    });

    it('accepts false (the Godot default)', () => {
      expect(check('follow_camera_enabled', 'false')).toBeNull();
    });

    it('rejects a non-boolean value', () => {
      const error = check('follow_camera_enabled', 'yes');
      expect(error?.code).toBe('INVALID_FOLLOW_CAMERA_ENABLED_FORMAT');
    });
  });

  describe('heightfield_mask', () => {
    it('accepts the Godot default', () => {
      expect(check('heightfield_mask', '1048575')).toBeNull();
    });

    it('accepts the full 32-bit mask', () => {
      expect(check('heightfield_mask', '4294967295')).toBeNull();
    });

    it('accepts zero (no layers)', () => {
      expect(check('heightfield_mask', '0')).toBeNull();
    });

    it('rejects a non-numeric value', () => {
      const error = check('heightfield_mask', 'not-a-number');
      expect(error?.code).toBe('INVALID_HEIGHTFIELD_MASK_FORMAT');
    });

    it('rejects a value past the 32-bit ceiling', () => {
      const error = check('heightfield_mask', '4294967296');
      expect(error?.code).toBe('INVALID_HEIGHTFIELD_MASK_VALUE');
    });
  });

  it('delivers the inherited cull_mask through the base-walk, proving the tier import is wired', () => {
    const validator = validatorRegistry.findValidator('GPUParticlesCollisionHeightField3D', 'cull_mask');
    expect(validator).not.toBeNull();
    expect(validator!('cull_mask', 'not-a-number', 1)?.code).toBeTruthy();
    expect(validator!('cull_mask', '4294967295', 1)).toBeNull();
  });
});
