/**
 * Skeleton3D strict validators for linting.
 * Migrated to the declarative `v` namespace (WI-ARCH-1).
 *
 * Bone properties (`bones/<idx>/<sub>`) keep a bespoke validator
 * because the sub-property name drives format choice (Vector3 for
 * position/scale, Quaternion for rotation) and the indexed key needs
 * its own message wording.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import {
  v,
  VECTOR3_REGEX,
} from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

const MODIFIER_CALLBACK_MODE = { 0: 'PHYSICS', 1: 'IDLE', 2: 'MANUAL' };

const QUATERNION_REGEX =
  /^Quaternion\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

/** Custom boolean validator with the legacy "true or false" message wording. */
function legacyBoolean(name: string): PropertyValidator {
  return (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return {
        severity: 'error',
        message: `Property '${name}' must be true or false, got: "${value}"`,
        line,
        column: key.length + 3,
        code: `INVALID_${name.toUpperCase()}_FORMAT`,
      };
    }
    return null;
  };
}

const bonesValidator: PropertyValidator = (key, value, line) => {
  const match = key.match(/^bones\/(\d+)\/(.+)$/);
  if (!match || !match[1] || !match[2]) {
    const negativeMatch = key.match(/^bones\/(-\d+)\//);
    if (negativeMatch) {
      return {
        severity: 'error',
        message: `Bone index must be non-negative, got: ${negativeMatch[1]}`,
        line,
        column: 1,
        code: 'INVALID_BONE_INDEX',
      };
    }
    return {
      severity: 'error',
      message: `Invalid bone property key format: "${key}". Expected: bones/<number>/<property>`,
      line,
      column: 1,
      code: 'INVALID_BONE_PROPERTY_KEY',
    };
  }

  const propertyName = match[2];

  if (propertyName === 'position' || propertyName === 'scale') {
    if (!VECTOR3_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property '${key}' must be Vector3 format like Vector3(0, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_BONE_VECTOR3_FORMAT',
      };
    }
  } else if (propertyName === 'rotation') {
    if (!QUATERNION_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property '${key}' must be Quaternion format like Quaternion(0, 0, 0, 1), got: "${value}"`,
        line,
        column: key.length + 3,
        code: 'INVALID_BONE_QUATERNION_FORMAT',
      };
    }
  }

  return null;
};

validatorRegistry.registerAll('Skeleton3D', {
  motion_scale: v.float('motion_scale', {
    min: Number.MIN_VALUE,
    message:
      "Property 'motion_scale' must be greater than 0. A value of 0 or less prevents animations from applying.",
  }),
  show_rest_only: legacyBoolean('show_rest_only'),
  animate_physical_bones: legacyBoolean('animate_physical_bones'),
  modifier_callback_mode_process: v.enumInt(
    'modifier_callback_mode_process',
    0,
    2,
    MODIFIER_CALLBACK_MODE
  ),
  'bones/*': bonesValidator,
});
