/**
 * Renders the geometry for a MeshInstance3D's `mesh` SubResource, built by
 * `primitiveMeshGeometry.ts`. Renders nothing for an unknown, external (GLB) or
 * unresolvable mesh, and the caller decides on a placeholder.
 */

import type { TscnInternalResource } from '../../../parser/types';
import { buildPrimitiveMeshGeometry } from './primitiveMeshGeometry';
import { useContentMemo } from '../../../resources/useContentMemo';

export interface MeshGeometryProps {
  resource: TscnInternalResource;
}

export function MeshGeometry({ resource }: MeshGeometryProps) {
  const geometry = useContentMemo(resource, buildPrimitiveMeshGeometry);

  return geometry ? <primitive object={geometry} attach="geometry" /> : null;
}
