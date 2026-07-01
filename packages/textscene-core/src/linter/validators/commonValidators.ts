/** Shared validator utilities for common property types */

import type { ParseError } from '../../linter/types.js';
import { propertyError } from './propertyError.js';

/**
 * Creates a boolean validator function
 * Validates that a value is either 'true' or 'false'
 */
export function createBooleanValidator(
  propertyName: string,
  errorCode: string = 'INVALID_BOOLEAN_FORMAT'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    if (value !== 'true' && value !== 'false') {
      return propertyError(key, line, `Property '${propertyName}' must be a boolean (true or false), got: "${value}"`, errorCode);
    }
    return null;
  };
}

/**
 * Creates an enum validator for integer enum values
 */
export function createEnumValidator(
  propertyName: string,
  min: number,
  max: number,
  enumValues: Record<number, string>,
  errorCodeFormat: string = 'INVALID_FORMAT',
  errorCodeValue: string = 'INVALID_VALUE'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return propertyError(key, line, `Property '${propertyName}' must be a number, got: "${value}"`, errorCodeFormat);
    }
    if (num < min || num > max) {
      const validValuesStr = Object.entries(enumValues)
        .map(([val, name]) => `${val}=${name}`)
        .join(', ');
      return propertyError(key, line, `Property '${propertyName}' must be ${min}-${max} (got ${num}). Valid values: ${validValuesStr}`, errorCodeValue);
    }
    return null;
  };
}

/**
 * Creates a numeric range validator for float/int values
 */
export function createNumericRangeValidator(
  propertyName: string,
  min: number | null,
  max: number | null,
  parseAsInt: boolean = false,
  customMessage?: string,
  errorCodeFormat: string = 'INVALID_FORMAT',
  errorCodeValue: string = 'INVALID_VALUE'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    const num = parseAsInt ? parseInt(value, 10) : parseFloat(value);
    if (isNaN(num)) {
      return propertyError(key, line, `Property '${propertyName}' must be a number, got: "${value}"`, errorCodeFormat);
    }

    // Check min constraint
    if (min !== null && num < min) {
      // Pick a default message based on whether one bound or two are set.
      // Two bounds → "must be between X and Y" (matches the wording the
      // per-node linter tests assert). One bound → "must be >= X" or
      // "must be non-negative" (the legacy single-bound wording).
      let defaultMsg: string;
      if (max !== null) {
        defaultMsg = `Property '${propertyName}' must be between ${min} and ${max} (got ${num})`;
      } else if (min === 0) {
        defaultMsg = `Property '${propertyName}' must be non-negative (got ${num})`;
      } else {
        defaultMsg = `Property '${propertyName}' must be >= ${min}, got: ${num}`;
      }
      return propertyError(key, line, customMessage || defaultMsg, errorCodeValue);
    }

    // Check max constraint
    if (max !== null && num > max) {
      const defaultMsg =
        min !== null
          ? `Property '${propertyName}' must be between ${min} and ${max} (got ${num})`
          : `Property '${propertyName}' must be <= ${max}, got: ${num}`;
      return propertyError(key, line, customMessage || defaultMsg, errorCodeValue);
    }

    return null;
  };
}

/**
 * Creates a validator for positive integers (> 0)
 * Useful for properties that would cause division by zero if set to 0
 */
export function createPositiveIntegerValidator(
  propertyName: string,
  errorMessage?: string,
  errorCodeFormat: string = 'INVALID_FORMAT',
  errorCodeValue: string = 'INVALID_VALUE'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return propertyError(key, line, `Property '${propertyName}' must be a number, got: "${value}"`, errorCodeFormat);
    }
    if (num <= 0) {
      const defaultMsg = `Property '${propertyName}' must be greater than 0 (got ${num}). Zero or negative values cause division by zero.`;
      return propertyError(key, line, errorMessage || defaultMsg, errorCodeValue);
    }
    return null;
  };
}
