/** Shared validator utilities for resource references */

import type { ParseError } from '../../linter/types.js';
import { propertyError } from './propertyError.js';
import { NODE_PATH_LITERAL_RE, RESOURCE_REF_RE } from '../../godot/index.js';

/**
 * Resource reference format: `SubResource("id")` or `ExtResource("id")`.
 *
 * The validator and the parsers that later RESOLVE the reference read one
 * pattern, from `godot/variantParser.ts`. They did not: this copy alone was
 * widened to tolerate `SubResource ( "id" )`, so the linter passed a value that
 * `extractLibraries` and `extractSubResourceId` then dropped, and the id went
 * missing with no diagnostic anywhere. Its id class also read `[\w-]+` where
 * every resolver reads `[^"]+`, making the linter the strictest reader of an id
 * it does not itself look up.
 */
export const RESOURCE_REFERENCE_REGEX = RESOURCE_REF_RE;

/**
 * NodePath format: `NodePath("path/to/node")`.
 *
 * `[^"]*` rather than `.*`: the greedy form only checked the first and last
 * character, so `NodePath("a") junk NodePath("b")` validated as one path — the
 * same shape of hole `v.quotedString` had. Measured across the corpus (784
 * NodePath values) the two forms disagree on nothing.
 */
export const NODE_PATH_REGEX = NODE_PATH_LITERAL_RE;

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

/*
 * There is deliberately no bare "non-empty string" validator here.
 *
 * One existed, and `Area2D`/`Area3D.audio_bus_name` were its only callers. It
 * tested `value.trim().length === 0` and nothing else, so an unquoted bare word
 * passed — while both properties are `Variant::STRING_NAME` (area_2d.cpp:670,
 * area_3d.cpp:800) and serialise as `&"Master"` or `"Master"`. The validator
 * therefore accepted a form Godot's own text parser rejects, which is the exact
 * opposite of what a format check is for. Both sites now use `v.stringName`.
 *
 * A string property in a `.tscn` is always quoted. Reach for `v.quotedString`
 * or `v.stringName` by the getter's type; if neither fits, the honest spelling
 * is `v.any()`, which says "no format constraint" out loud instead of implying
 * a check that is not there.
 */
