/**
 * One property against the registered validators. The error carries no owner: the observer stamps it with the
 * section the property sits in.
 */

import type { ParsedProperty } from '../../parser/TscnParserCore.js';
import type { ParseError } from '../types.js';
import { validatorRegistry } from '../ValidatorRegistry.js';
import { ownsNilMessage } from '../propertyValidator.js';
import { isNilLiteral } from '../../godot/index.js';

/** The refusal for one property, or null where no validator claims it or the value passes. */
export function propertyRefusal({
  ownerType,
  key,
  value,
  line,
  isMultiline,
  stored,
}: ParsedProperty): ParseError | null {
  // Multi-line values (shader code, label text) and properties without a typed owner (index=/instance= nodes,
  // ext_resource/gd_scene sections) go unvalidated.
  if (isMultiline || !ownerType) return null;

  // The key as written first. Where nothing claims that spelling, the pair the engine applies
  // (`godot/deprecated.ts` resolves the alias and transforms the value), and the diagnostic names both,
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

  const found = validator(lookupKey, lookupValue, line);
  if (!found) return null;
  const error =
    lookupKey === key
      ? found
      : {
          ...found,
          // The validator's `propertyError` anchors the column on the key it was handed. The rebase
          // lands it on the value after the key as written.
          column: found.column - lookupKey.length + key.length,
          message: `Property '${key}' is applied as '${lookupKey} = ${lookupValue}': ${found.message}`,
        };
  return isNilLiteral(value) && !ownsNilMessage(error) ? nilConversion(error, key, value) : error;
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
