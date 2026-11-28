/**
 * One property against the registered validators. The error carries no owner: the observer stamps it with the
 * section the property sits in.
 */

import type { ParsedProperty } from '../../parser/TscnParserCore.js';
import type { ParseError } from '../types.js';
import { validatorRegistry } from '../ValidatorRegistry.js';
import { ownsNilMessage } from '../propertyValidator.js';
import { isNilLiteral } from '../../godot/variant/variantParser.js';

/** The refusal for one property, or null where no validator claims it or the value passes. */
export function propertyRefusal(property: ParsedProperty): ParseError | null {
  const { ownerType, key, value, valueStart, stored } = property;
  // A value over several lines (shader code, label text) or with no typed owner goes unvalidated.
  if (value.includes('\n') || !ownerType) return null;

  // The key as written first. Where nothing claims that spelling, the pair the engine applies
  // (`godot/classdb/deprecated.ts` resolves the alias and transforms the value), and the diagnostic names both,
  // because the canonical key appears nowhere in the file.
  let lookupKey = key;
  let lookupValue = value;
  let validator = validatorRegistry.findValidator(ownerType, key);
  if (!validator) {
    if (stored.key === key) return null;
    validator = validatorRegistry.findValidator(ownerType, stored.key);
    if (!validator) return null;
    lookupKey = stored.key;
    lookupValue = stored.value;
  }

  const validated = validator(lookupKey, lookupValue, valueStart.line);
  if (!validated) return null;
  const found: ParseError = { ...validated, ...writtenPlace(validated.column, lookupKey, property) };
  const keyed: ParseError = { ...found, propertyKey: key };
  const error: ParseError =
    lookupKey === key
      ? keyed
      : {
          ...keyed,
          message: `Property '${key}' is applied as '${lookupKey} = ${lookupValue}': ${found.message}`,
        };
  return isNilLiteral(value) && !ownsNilMessage(error) ? nilConversion(error, key, value) : error;
}

// A validator anchors on a line `key = value`: below `key.length + 3` in the key, from it on in the value.
function writtenPlace(
  anchor: number,
  lookupKey: string,
  { line, column, valueStart }: ParsedProperty
): { line: number; column: number } {
  const valueAnchor = lookupKey.length + 3;
  if (anchor < valueAnchor) return { line, column: column + anchor };
  return { line: valueStart.line, column: valueStart.column + 1 + anchor - valueAnchor };
}

/**
 * `null` is legal anywhere (variant_parser.cpp:699), and NIL converts strictly only to OBJECT (variant.cpp:543-544):
 * on 4.6.3 `Control`, `texture_filter = null` stores 0 and `visible = null` stores false. `ownsNilMessage` keeps a key
 * verdict (no such slot) and a nil verdict (an OBJECT setter's `ERR_FAIL_COND(...is_null())`, the one refusal with
 * a `file:line`). Both ride on the error: `findValidator` returns a dispatcher and `withFiniteGuard` a wrapper.
 */
function nilConversion(error: ParseError, key: string, value: string): ParseError {
  return {
    // Line, column and code stay the validator's, so the diagnostic anchors on the value.
    ...error,
    // ADR-0032's conversion tier: the setter receives the zero and refuses nothing, as for `hframes = 5.5`.
    severity: 'warning',
    // No contrast with the default, which this seam cannot look up: `CanvasItem::texture_filter` defaults to
    // TEXTURE_FILTER_PARENT_NODE, which is 0 (canvas_item.h:123).
    message:
      `Property '${key}' is ${value.trim()}, which this slot cannot hold: Godot stores ` +
      `the type's zero value instead.`,
  };
}
