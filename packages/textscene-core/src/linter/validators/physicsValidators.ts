/** Shared validator utilities for physics-related properties */

import type { ParseError } from '../../linter/types.js';

/** Collision layer/mask bitmask maximum (20 bits: 2^20 - 1 = 1048575) */
export const MAX_COLLISION_BITMASK = 1048575;

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
 * Validates bitmask in range 0-1048575 (20 bits)
 */
export function createCollisionLayerValidator(
  errorCodeFormat: string = 'INVALID_COLLISION_LAYER_FORMAT',
  errorCodeValue: string = 'INVALID_COLLISION_LAYER_VALUE'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'collision_layer' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: errorCodeFormat,
      };
    }
    if (num < 0 || num > MAX_COLLISION_BITMASK) {
      return {
        severity: 'error',
        message: `Property 'collision_layer' must be between 0 and ${MAX_COLLISION_BITMASK} (got ${num}). Valid range: 20-bit bitmask`,
        line,
        column: key.length + 3,
        code: errorCodeValue,
      };
    }
    return null;
  };
}

/**
 * Creates a collision mask validator
 * Validates bitmask in range 0-1048575 (20 bits)
 */
export function createCollisionMaskValidator(
  errorCodeFormat: string = 'INVALID_COLLISION_MASK_FORMAT',
  errorCodeValue: string = 'INVALID_COLLISION_MASK_VALUE'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return {
        severity: 'error',
        message: `Property 'collision_mask' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: errorCodeFormat,
      };
    }
    if (num < 0 || num > MAX_COLLISION_BITMASK) {
      return {
        severity: 'error',
        message: `Property 'collision_mask' must be between 0 and ${MAX_COLLISION_BITMASK} (got ${num}). Valid range: 20-bit bitmask`,
        line,
        column: key.length + 3,
        code: errorCodeValue,
      };
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
      return {
        severity: 'error',
        message: `Property '${propertyName}' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: errorCodeFormat,
      };
    }
    if (num < 0 || num > 4) {
      const validValuesStr = Object.entries(SPACE_OVERRIDE_VALUES)
        .map(([val, name]) => `${val}=${name}`)
        .join(', ');
      return {
        severity: 'error',
        message: `Property '${propertyName}' must be 0-4 (got ${num}). Valid values: ${validValuesStr}`,
        line,
        column: key.length + 3,
        code: errorCodeValue,
      };
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
      return {
        severity: 'error',
        message: `Property 'disable_mode' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: errorCodeFormat,
      };
    }
    if (num < 0 || num > 2) {
      const validValuesStr = Object.entries(DISABLE_MODE_VALUES)
        .map(([val, name]) => `${val}=${name}`)
        .join(', ');
      return {
        severity: 'error',
        message: `Property 'disable_mode' must be 0-2 (got ${num}). Valid values: ${validValuesStr}`,
        line,
        column: key.length + 3,
        code: errorCodeValue,
      };
    }
    return null;
  };
}
