/** Validators for resource-reference and NodePath slots. */

import type { ParseError } from '../../linter/types.js';
import { propertyError } from './propertyError.js';
import { isNilLiteral, nodePathLiteral, resourceRef } from '../../godot/index.js';

/**
 * Every resource-reference validator, so a sweep can ask whether a registered
 * declaration is a resource slot without parsing its `accepts` prose.
 * Identity-keyed: `shape()` and the registry hand back the same function.
 * Written only by `createResourceReferenceValidator`.
 */
const RESOURCE_SLOT_VALIDATORS = new WeakSet<object>();

/** Whether `validator` is one `createResourceReferenceValidator` built. */
export function isResourceSlotValidator(validator: object): boolean {
  return RESOURCE_SLOT_VALIDATORS.has(validator);
}

/** A validator for `SubResource("id")`, `ExtResource("id")` or `null`. */
export function createResourceReferenceValidator(
  propertyName: string,
  errorCode: string = 'INVALID_REFERENCE'
): (key: string, value: string, line: number) => ParseError | null {
  const validator = (key: string, value: string, line: number): ParseError | null => {
    // NIL is legal for every resource slot, though the writer omits a cleared
    // one: `variant_parser.cpp:699` parses `null` and `nil` to `Variant()`,
    // `can_convert_strict` allows NIL -> OBJECT (variant.cpp:543), and a `Ref<T>`
    // setter takes an invalid Ref. Whether the slot should be filled is a rule's question.
    if (!isNilLiteral(value) && resourceRef(value) === null) {
      return propertyError(key, line, `Property '${propertyName}' must be a resource reference like SubResource("id") or ExtResource("id"), or null, got: "${value}"`, errorCode);
    }
    return null;
  };
  RESOURCE_SLOT_VALIDATORS.add(validator);
  return validator;
}

/**
 * A NodePath slot: the `NodePath("…")` literal, or the bare `"…"` string
 * `can_convert_strict` converts into it (`variant.cpp:746-749`). Every reader
 * of the slot goes through {@link nodePathLiteral}, so what passes here is
 * what the resolver follows.
 */
export function createNodePathValidator(
  propertyName: string,
  errorCode: string = 'INVALID_PATH'
): (key: string, value: string, line: number) => ParseError | null {
  return (key, value, line) => {
    if (nodePathLiteral(value) === null) {
      return propertyError(key, line, `Property '${propertyName}' must be a NodePath like NodePath("path/to/node") or a quoted string, got: "${value}"`, errorCode);
    }
    return null;
  };
}

/*
 * No bare "non-empty string" validator: a `.tscn` string is always quoted. Use
 * `v.quotedString` or `v.stringName` by the getter's type, as the STRING_NAME
 * `audio_bus_name` does (area_2d.cpp:670, area_3d.cpp:800), or `v.any()`, which
 * says "no format constraint" out loud.
 */
