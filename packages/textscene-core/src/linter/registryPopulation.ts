/**
 * The types the registry holds, the one population production reads. The key and validator
 * populations a sweep walks are `testing/registryPopulation.ts`. A point lookup on a named type
 * stays the registry's, and the population guard keeps every walk without a named type in these
 * two files.
 */

import { validatorRegistry, type ValidatorRegistry } from './ValidatorRegistry.js';

/**
 * Types the registry can answer for. `'declaring'` is the validator map's key
 * set, with an empty map (`CheckButton`) but without a removal-only type
 * (`HBoxContainer`). `'answering'` adds the removals. Neither contains the other,
 * so there is no default.
 */
export function registeredTypes(
  scope: 'declaring' | 'answering',
  registry: ValidatorRegistry = validatorRegistry
): readonly string[] {
  const declaring = registry.typesWithRegistrations();
  if (scope === 'declaring') return declaring;
  return [...new Set([...declaring, ...registry.getTypesWithRemovals()])];
}
