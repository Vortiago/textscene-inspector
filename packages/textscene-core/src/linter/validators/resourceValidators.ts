/** Shared validator utilities for resource references */

import type { ParseError } from '../../linter/types.js';
import { propertyError } from './propertyError.js';
import { NODE_PATH_LITERAL_RE, RESOURCE_REF_RE, isNilLiteral } from '../../godot/index.js';

/**
 * Creates a resource reference validator
 * Validates SubResource("id") or ExtResource("id") format
 */
export function createResourceReferenceValidator(
  propertyName: string,
  errorCode: string = 'INVALID_REFERENCE'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    // NIL is legal for every resource slot. Godot's writer normally omits a
    // cleared one instead of emitting `null`, which is a WRITE-side fact and
    // reads as a reason to reject the spelling; it is not one.
    // `variant_parser.cpp:699` parses `null` AND `nil` through one arm to
    // `Variant()`, `can_convert_strict` allows NIL -> OBJECT (variant.cpp:543),
    // and a `Ref<T>` setter takes an invalid Ref without complaint, so the value
    // LOADS. Whether the slot ought to be filled is a semantic rule's question.
    if (!isNilLiteral(value) && !RESOURCE_REF_RE.test(value)) {
      return propertyError(key, line, `Property '${propertyName}' must be a resource reference like SubResource("id") or ExtResource("id"), or null, got: "${value}"`, errorCode);
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
    if (!NODE_PATH_LITERAL_RE.test(value)) {
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
