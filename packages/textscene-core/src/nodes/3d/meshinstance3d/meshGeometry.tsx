/**
 * Renders the geometry for a MeshInstance3D's `mesh` SubResource.
 *
 * The construction itself lives in `primitiveMeshGeometry.ts` as a plain function, so
 * callers that need geometry as DATA rather than JSX can share exactly one definition of
 * each Godot primitive: CSGMesh3D wraps a mesh resource as a CSG contribution, and the
 * boolean evaluator needs triangles rather than a React element. Two definitions would
 * drift, and the axis and winding corrections in there are precisely the kind of detail
 * that drifts silently.
 *
 * Renders nothing for unknown / external (GLB) / unresolvable mesh references; the caller
 * decides whether that warrants a placeholder.
 */

import { useMemo } from 'react';
import type { TscnInternalResource } from '../../../parser/types';
import {
  buildPrimitiveMeshGeometry,
  primitiveMeshGeometryKey,
} from './primitiveMeshGeometry';

export interface MeshGeometryProps {
  resource: TscnInternalResource;
}

export function MeshGeometry({ resource }: MeshGeometryProps) {
  // Keyed on the resource's CONTENT, not its identity: the parser allocates a fresh
  // resource per parse and the source pane reparses on every keystroke, so an
  // identity-keyed memo would rebuild (and never dispose) the geometry every tick.
  const key = primitiveMeshGeometryKey(resource);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` IS the content of `resource`.
  const geometry = useMemo(() => buildPrimitiveMeshGeometry(resource), [key]);

  return geometry ? <primitive object={geometry} attach="geometry" /> : null;
}
