/**
 * The one physics validator that is still hand-rolled.
 *
 * The collision layer/mask and disable-mode builders that used to live here
 * were deleted when the CollisionObject2D/3D tier took ownership of those
 * properties: `layerBitmask` and `v.enumInt` express them, and the copies had
 * already drifted from Godot's bounds. `space_override` stays hand-rolled only
 * because its message enumerates the five constants by name.
 */

import type { ParseError } from '../../linter/types.js';
import type { PropertyValidator } from '../ValidatorRegistry.js';
import { propertyError } from './propertyError.js';

/** Space override enum values (used in Area2D/Area3D) */
export const SPACE_OVERRIDE_VALUES = {
  0: 'DISABLED',
  1: 'COMBINE',
  2: 'COMBINE_REPLACE',
  3: 'REPLACE',
  4: 'REPLACE_COMBINE',
};

/**
 * Creates a space override validator (0-4)
 * Used for space_override, gravity_space_override, linear_damp_space_override, angular_damp_space_override
 */
export function createSpaceOverrideValidator(
  propertyName: string,
  errorCodeFormat: string,
  errorCodeValue: string
): (key: string, value: string, line: number) => ParseError | null {
  const validator: PropertyValidator = (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return propertyError(key, line, `Property '${propertyName}' must be a number, got: "${value}"`, errorCodeFormat);
    }
    if (num < 0 || num > 4) {
      const validValuesStr = Object.entries(SPACE_OVERRIDE_VALUES)
        .map(([val, name]) => `${val}=${name}`)
        .join(', ');
      return propertyError(key, line, `Property '${propertyName}' must be 0-4 (got ${num}). Valid values: ${validValuesStr}`, errorCodeValue);
    }
    return null;
  };
  validator.accepts = 'enum 0-4 (DISABLED/COMBINE/COMBINE_REPLACE/REPLACE/REPLACE_COMBINE)';
  return validator;
}

