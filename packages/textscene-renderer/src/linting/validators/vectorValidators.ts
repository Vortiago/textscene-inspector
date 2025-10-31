/** Shared validator utilities for Vector types */

import type { ParseError } from '../../linter/types.js';

/** Vector2 format: Vector2(x, y) - two comma-separated numbers */
export const VECTOR2_REGEX = /^Vector2\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

/** Vector2i format: Vector2i(x, y) - two comma-separated integers */
export const VECTOR2I_REGEX = /^Vector2i\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/;

/** Vector3 format: Vector3(x, y, z) - three comma-separated numbers */
export const VECTOR3_REGEX = /^Vector3\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

/** Rect2 format: Rect2(x, y, width, height) */
export const RECT2_REGEX = /^Rect2\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

/** Transform3D format: Transform3D(12 comma-separated numbers) */
export const TRANSFORM3D_REGEX = /^Transform3D\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*,\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)$/;

/**
 * Creates a Vector2 validator
 */
export function createVector2Validator(
  propertyName: string,
  errorCode: string = 'INVALID_FORMAT'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    if (!VECTOR2_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property '${propertyName}' must be Vector2 with 2 numbers like Vector2(0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: errorCode,
      };
    }
    return null;
  };
}

/**
 * Creates a Vector2i validator with optional non-negative constraint
 */
export function createVector2iValidator(
  propertyName: string,
  requireNonNegative: boolean = false,
  errorCodeFormat: string = 'INVALID_FORMAT',
  errorCodeValue: string = 'INVALID_VALUE'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    const match = VECTOR2I_REGEX.exec(value);
    if (!match) {
      return {
        severity: 'error',
        message: `Property '${propertyName}' must be Vector2i format like Vector2i(0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: errorCodeFormat,
      };
    }

    if (requireNonNegative) {
      const x = parseInt(match[1] || '0', 10);
      const y = parseInt(match[2] || '0', 10);
      if (x < 0 || y < 0) {
        return {
          severity: 'error',
          message: `Property '${propertyName}' must have non-negative values, got: Vector2i(${x}, ${y})`,
          line,
          column: key.length + 3,
          code: errorCodeValue,
        };
      }
    }

    return null;
  };
}

/**
 * Creates a Vector3 validator
 */
export function createVector3Validator(
  propertyName: string,
  errorCode: string = 'INVALID_FORMAT'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    if (!VECTOR3_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property '${propertyName}' must be Vector3 with 3 numbers like Vector3(0, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: errorCode,
      };
    }
    return null;
  };
}

/**
 * Creates a Rect2 validator
 */
export function createRect2Validator(
  propertyName: string,
  errorCode: string = 'INVALID_FORMAT'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    if (!RECT2_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property '${propertyName}' must be Rect2 format like Rect2(0, 0, 100, 100), got: "${value}"`,
        line,
        column: key.length + 3,
        code: errorCode,
      };
    }
    return null;
  };
}

/**
 * Creates a Transform3D validator
 */
export function createTransform3DValidator(
  propertyName: string,
  errorCode: string = 'INVALID_FORMAT'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    if (!TRANSFORM3D_REGEX.test(value)) {
      return {
        severity: 'error',
        message: `Property '${propertyName}' must be Transform3D with 12 numbers like Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0), got: "${value}"`,
        line,
        column: key.length + 3,
        code: errorCode,
      };
    }
    return null;
  };
}
