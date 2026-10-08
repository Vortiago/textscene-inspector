/** Where an external `mesh` reference points, when it is an ArrayMesh `.tres`. */

import type { TscnExternalResource } from '../../../parser/types';
import { resolveExtResourcePath } from '../../../resources/SubResourceResolver';

/**
 * The `.tres` path of an external ArrayMesh. Null for a SubResource, a non-`.tres` file such as
 * `.glb`, or an unknown id.
 */
export function resolveExtArrayMeshPath(
  meshRef: string | undefined,
  externalResources: readonly TscnExternalResource[]
): string | null {
  const path = resolveExtResourcePath(meshRef, externalResources);
  return path?.endsWith('.tres') ? path : null;
}
