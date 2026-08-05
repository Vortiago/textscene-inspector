/**
 * Shared utility for checking resource existence in TSCN scenes
 *
 * Used by semantic linter rules to validate resource references.
 */

import type { TscnScene, TscnInternalResource, TscnExternalResource } from '../parser/types.js';

/**
 * Check if a resource reference exists in the scene
 * @param scene - The parsed TSCN scene
 * @param resourceRef - Resource reference string (e.g., "SubResource(\"mesh_1\")" or "ExtResource(\"texture_1\")")
 * @returns true if resource exists, false otherwise
 *
 * @example
 * ```typescript
 * const exists = checkResourceExists(scene, 'SubResource("mesh_1")');
 * if (!exists) {
 *   // Report error: resource not found
 * }
 * ```
 */
export function checkResourceExists(scene: TscnScene, resourceRef: string): boolean {
  // Extract resource type and ID from reference
  const match = resourceRef.match(/^(SubResource|ExtResource)\("([\w-]+)"\)$/);
  if (!match) {
    return false; // Invalid format (should be caught by linterParser)
  }

  const [, resourceType, resourceId] = match;

  // Both pools are non-optional on `TscnScene` and reached without a guard:
  // `TscnParserCore.parse` initialises each to `[]` and always returns both,
  // and it is the only producer of the type. Guarding here would suggest an
  // absent pool is a state worth handling, which would be a lie about the
  // contract — an empty pool already answers "no such resource" correctly.
  if (resourceType === 'SubResource') {
    // SubResource ID is stored in data.id (string), not top-level id (number)
    return scene.internalResources.some((r: TscnInternalResource) => r.data?.id === resourceId);
  } else if (resourceType === 'ExtResource') {
    // ExtResource ID is stored in id property
    return scene.externalResources.some((r: TscnExternalResource) => r.id === resourceId);
  }

  return false;
}
