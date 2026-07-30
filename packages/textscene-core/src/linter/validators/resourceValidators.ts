/** Shared validator utilities for resource references */

import type { ParseError } from '../../linter/types.js';
import { propertyError } from './propertyError.js';

/** Resource reference format: SubResource("id") or ExtResource("id") */
export const RESOURCE_REFERENCE_REGEX = /^(SubResource|ExtResource)\("[\w-]+"\)$/;

/**
 * NodePath format: `NodePath("path/to/node")`.
 *
 * `[^"]*` rather than `.*`: the greedy form only checked the first and last
 * character, so `NodePath("a") junk NodePath("b")` validated as one path — the
 * same shape of hole `v.quotedString` had. Measured across the corpus (784
 * NodePath values) the two forms disagree on nothing.
 */
export const NODE_PATH_REGEX = /^NodePath\("[^"]*"\)$/;

/**
 * Creates a resource reference validator
 * Validates SubResource("id") or ExtResource("id") format
 */
export function createResourceReferenceValidator(
  propertyName: string,
  errorCode: string = 'INVALID_REFERENCE'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    if (!RESOURCE_REFERENCE_REGEX.test(value)) {
      return propertyError(key, line, `Property '${propertyName}' must be a resource reference like SubResource("id") or ExtResource("id"), got: "${value}"`, errorCode);
    }
    return null;
  };
}

/**
 * Creates a NodePath validator
 * Validates NodePath("...") format
 */
export function createNodePathValidator(
  propertyName: string,
  errorCode: string = 'INVALID_PATH'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    if (!NODE_PATH_REGEX.test(value)) {
      return propertyError(key, line, `Property '${propertyName}' must be a NodePath like NodePath("path/to/node"), got: "${value}"`, errorCode);
    }
    return null;
  };
}

/**
 * Creates a string validator (accepts any non-empty string)
 */
export function createStringValidator(
  propertyName: string,
  errorCode: string = 'INVALID_STRING_FORMAT'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    if (typeof value !== 'string' || value.trim().length === 0) {
      return propertyError(key, line, `Property '${propertyName}' must be a non-empty string, got: "${value}"`, errorCode);
    }
    return null;
  };
}
