/** Shared validator utilities for common property types */

import type { ParseError } from '../../linter/types.js';

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
      return {
        severity: 'error',
        message: `Property '${propertyName}' must be a boolean (true or false), got: "${value}"`,
        line,
        column: key.length + 3,
        code: errorCode,
      };
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
      return {
        severity: 'error',
        message: `Property '${propertyName}' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: errorCodeFormat,
      };
    }
    if (num < min || num > max) {
      const validValuesStr = Object.entries(enumValues)
        .map(([val, name]) => `${val}=${name}`)
        .join(', ');
      return {
        severity: 'error',
        message: `Property '${propertyName}' must be ${min}-${max} (got ${num}). Valid values: ${validValuesStr}`,
        line,
        column: key.length + 3,
        code: errorCodeValue,
      };
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
      return {
        severity: 'error',
        message: `Property '${propertyName}' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: errorCodeFormat,
      };
    }

    // Check min constraint
    if (min !== null && num < min) {
      const defaultMsg = min === 0
        ? `Property '${propertyName}' must be non-negative (got ${num})`
        : `Property '${propertyName}' must be >= ${min}, got: ${num}`;
      return {
        severity: 'error',
        message: customMessage || defaultMsg,
        line,
        column: key.length + 3,
        code: errorCodeValue,
      };
    }

    // Check max constraint
    if (max !== null && num > max) {
      return {
        severity: 'error',
        message: customMessage || `Property '${propertyName}' must be <= ${max}, got: ${num}`,
        line,
        column: key.length + 3,
        code: errorCodeValue,
      };
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
      return {
        severity: 'error',
        message: `Property '${propertyName}' must be a number, got: "${value}"`,
        line,
        column: key.length + 3,
        code: errorCodeFormat,
      };
    }
    if (num <= 0) {
      const defaultMsg = `Property '${propertyName}' must be greater than 0 (got ${num}). Zero or negative values cause division by zero.`;
      return {
        severity: 'error',
        message: errorMessage || defaultMsg,
        line,
        column: key.length + 3,
        code: errorCodeValue,
      };
    }
    return null;
  };
}
