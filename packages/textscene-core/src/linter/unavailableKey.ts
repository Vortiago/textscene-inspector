/**
 * A key a concrete type takes away from its base, and the validator that
 * reports one. The registry resolves removals in the same base walk as
 * validators. Here, the key's presence is the defect, at the error tier.
 */

import type { PropertyValidator } from './propertyValidator.js';
import { keyShapeError } from './validators/propertyError.js';

/**
 * A key a concrete type takes away from its base, and the engine guard that
 * takes it away. `reason` reaches the scene author; `cite` is what makes the
 * claim checkable, exactly as `PropertyValidator.grounding` does for a bound.
 */
export interface Removal {
  reason: string;
  /** `file:line` of the guard that refuses the write. */
  cite: string;
}

/**
 * The validator a removed key resolves to, memoised per (type, reason, cite) so
 * repeated lookups return the same function. Written only by `unavailableValidator`.
 */
const unavailableValidators = new Map<string, PropertyValidator>();

/** Rejects every value, because the key's presence is itself the defect. */
export function unavailableValidator(nodeType: string, removal: Removal): PropertyValidator {
  // The cite is part of the key: two removals sharing a reason but citing
  // different lines each report their own guard.
  const cacheKey = `${nodeType}\u0000${removal.reason}\u0000${removal.cite}`;
  const cached = unavailableValidators.get(cacheKey);
  if (cached) return cached;
  const validator: PropertyValidator = (key, _value, line) =>
    keyShapeError(
      key,
      line,
      `Property '${key}' cannot be set on ${nodeType}: ${removal.reason}`,
      `UNAVAILABLE_${key.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
    );
  validator.accepts = 'not available on this type';
  // A removal refuses every value of a key a scene may legitimately carry, so it
  // is a grounded rejection (ADR-0032), not a format check.
  validator.grounding = { kind: 'enforced', cite: removal.cite };
  unavailableValidators.set(cacheKey, validator);
  return validator;
}
