/** Where an external `mesh` reference points, when it is an ArrayMesh `.tres`. */

import type { TscnExternalResource } from '../../../parser/types';
import { findExtResource, parseResourceReference } from '../../../resources/SubResourceResolver';

/**
 * The `.tres` path of an `ExtResource("id")` ArrayMesh. Null for a SubResource,
 * a non-`.tres` ExtResource such as `.glb`, or an unknown id.
 */
export function resolveExtArrayMeshPath(
  meshRef: string | undefined,
  externalResources: readonly TscnExternalResource[]
): string | null {
  if (!meshRef) return null;
  const parsed = parseResourceReference(meshRef);
  if (!parsed || parsed.type !== 'ExtResource') return null;
  const ext = findExtResource(externalResources, parsed.id);
  if (!ext?.path || !ext.path.endsWith('.tres')) return null;
  return ext.path;
}
