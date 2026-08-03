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

  if (resourceType === 'SubResource') {
    // The parser mirrors the heading id into data.id; the checker keys off it there.
    return scene.internalResources.some((r: TscnInternalResource) => r.data.id === resourceId);
  } else if (resourceType === 'ExtResource') {
    return scene.externalResources.some((r: TscnExternalResource) => r.id === resourceId);
  }

  return false;
}
