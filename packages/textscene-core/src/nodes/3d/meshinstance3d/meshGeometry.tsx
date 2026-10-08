/**
 * Renders the geometry for a MeshInstance3D's `mesh` SubResource, built by
 * `primitiveMeshGeometry.ts`. Renders nothing for an unknown, external (GLB) or
 * unresolvable mesh, and the caller decides on a placeholder.
 */

import { useMemo } from 'react';
import type { TscnInternalResource } from '../../../parser/types';
import { buildPrimitiveMeshGeometry } from './primitiveMeshGeometry';
import { resourceContentKey } from '../../../resources/resourceContentKey';

export interface MeshGeometryProps {
  resource: TscnInternalResource;
}

export function MeshGeometry({ resource }: MeshGeometryProps) {
  // Keyed on the resource's content, not its identity: see resourceContentKey.
  const key = resourceContentKey(resource);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` IS the content of `resource`.
  const geometry = useMemo(() => buildPrimitiveMeshGeometry(resource), [key]);

  return geometry ? <primitive object={geometry} attach="geometry" /> : null;
}
