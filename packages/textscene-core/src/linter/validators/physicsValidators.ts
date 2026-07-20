/** Shared validator utilities for physics-related properties */

import type { ParseError } from '../../linter/types.js';
import { propertyError } from './propertyError.js';
import { MAX_LAYER_BITMASK } from './layerBitmask.js';

/**
 * Collision layer/mask bitmask maximum. Godot stores these as 32-bit masks —
 * see `layerBitmask.ts` for why 1048575 (the 20 user-visible render layers)
 * is a default, never a bound.
 */
export const MAX_COLLISION_BITMASK = MAX_LAYER_BITMASK;

/** Space override enum values (used in Area2D/Area3D) */
export const SPACE_OVERRIDE_VALUES = {
  0: 'DISABLED',
  1: 'COMBINE',
  2: 'COMBINE_REPLACE',
  3: 'REPLACE',
  4: 'REPLACE_COMBINE',
};

/** Disable mode enum values (used in physics nodes) */
export const DISABLE_MODE_VALUES = {
  0: 'REMOVE',
  1: 'MAKE_STATIC',
  2: 'KEEP_ACTIVE',
};

/**
 * Creates a collision layer validator
 * Validates a 32-bit bitmask (0 .. 2^32 - 1)
 */
export function createCollisionLayerValidator(
  errorCodeFormat: string = 'INVALID_COLLISION_LAYER_FORMAT',
  errorCodeValue: string = 'INVALID_COLLISION_LAYER_VALUE'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return propertyError(key, line, `Property 'collision_layer' must be a number, got: "${value}"`, errorCodeFormat);
    }
    if (num < 0 || num > MAX_COLLISION_BITMASK) {
      return propertyError(key, line, `Property 'collision_layer' must be between 0 and ${MAX_COLLISION_BITMASK} (got ${num}). Valid range: 32-bit bitmask`, errorCodeValue);
    }
    return null;
  };
}

/**
 * Creates a collision mask validator
 * Validates a 32-bit bitmask (0 .. 2^32 - 1)
 */
export function createCollisionMaskValidator(
  errorCodeFormat: string = 'INVALID_COLLISION_MASK_FORMAT',
  errorCodeValue: string = 'INVALID_COLLISION_MASK_VALUE'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return propertyError(key, line, `Property 'collision_mask' must be a number, got: "${value}"`, errorCodeFormat);
    }
    if (num < 0 || num > MAX_COLLISION_BITMASK) {
      return propertyError(key, line, `Property 'collision_mask' must be between 0 and ${MAX_COLLISION_BITMASK} (got ${num}). Valid range: 32-bit bitmask`, errorCodeValue);
    }
    return null;
  };
}

/**
 * Creates a space override validator (0-4)
 * Used for space_override, gravity_space_override, linear_damp_space_override, angular_damp_space_override
 */
export function createSpaceOverrideValidator(
  propertyName: string,
  errorCodeFormat: string,
  errorCodeValue: string
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
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
}

/**
 * Creates a disable mode validator (0-2)
 */
export function createDisableModeValidator(
  errorCodeFormat: string = 'INVALID_DISABLE_MODE_FORMAT',
  errorCodeValue: string = 'INVALID_DISABLE_MODE_VALUE'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return propertyError(key, line, `Property 'disable_mode' must be a number, got: "${value}"`, errorCodeFormat);
    }
    if (num < 0 || num > 2) {
      const validValuesStr = Object.entries(DISABLE_MODE_VALUES)
        .map(([val, name]) => `${val}=${name}`)
        .join(', ');
      return propertyError(key, line, `Property 'disable_mode' must be 0-2 (got ${num}). Valid values: ${validValuesStr}`, errorCodeValue);
    }
    return null;
  };
}
