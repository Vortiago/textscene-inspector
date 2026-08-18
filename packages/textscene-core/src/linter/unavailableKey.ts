/**
 * A key a concrete type takes away from its base, and the validator that
 * reports one.
 *
 * The registry stores removals beside validators and resolves them in the same
 * base walk; what a removal MEANS — that the key's presence is itself the
 * defect, at the error tier, with the guard cited — lives here.
 */

import type { PropertyValidator } from './propertyValidator.js';
import { propertyError } from './validators/propertyError.js';

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
 * The validator a removed key resolves to: it rejects every value, because the
 * key's presence is itself the defect. Memoised per (type, reason) so repeated
 * lookups of the same removal return the same function, which keeps identity
 * comparisons in the tests meaningful.
 */
const unavailableValidators = new Map<string, PropertyValidator>();

export function unavailableValidator(nodeType: string, removal: Removal): PropertyValidator {
  // The CITE is part of the identity, not just the reason: the validator now
  // records `grounding.cite`, so two removals on one type sharing a reason but
  // citing different lines would otherwise both get whichever was memoised
  // first, and the second would report a citation for the wrong guard.
  const cacheKey = `${nodeType}\u0000${removal.reason}\u0000${removal.cite}`;
  const cached = unavailableValidators.get(cacheKey);
  if (cached) return cached;
  const validator: PropertyValidator = (key, _value, line) =>
    propertyError(
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
  validator.keyVerdict = true;
  return validator;
}
