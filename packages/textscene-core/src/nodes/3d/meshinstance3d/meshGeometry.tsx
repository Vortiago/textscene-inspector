/**
 * Renders the geometry for a MeshInstance3D's `mesh` SubResource, built by
 * `primitiveMeshGeometry.ts`. Renders nothing for an unknown, external (GLB) or
 * unresolvable mesh, and the caller decides on a placeholder.
 */

import { useEffect } from 'react';
import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { buildPrimitiveMeshGeometry } from './primitiveMeshGeometry';
import { useContentMemo } from '../../../resources/useContentMemo';
import { projectPrimitiveMeshTexelSize } from '../../../parser/projectSettingsParser';
import { useProjectSettings } from '../../../r3f/contexts/ProjectSettingsContext';

interface MeshGeometryProps {
  resource: TscnInternalResource;
}

export function MeshGeometry({ resource }: MeshGeometryProps) {
  const geometry = usePrimitiveMeshGeometry(resource);
  return geometry ? <primitive object={geometry} attach="geometry" /> : null;
}

/**
 * A PrimitiveMesh's geometry at the project's texel size, or null for no resource or a mesh
 * `buildPrimitiveMeshGeometry` builds nothing for. This hook disposes the geometry: r3f never
 * disposes an object handed to `<primitive>` or `args`.
 */
export function usePrimitiveMeshGeometry(resource: TscnInternalResource | null): THREE.BufferGeometry | null {
  const texelSize = projectPrimitiveMeshTexelSize(useProjectSettings().settings);
  const geometry = useContentMemo(resource, (r) => buildPrimitiveMeshGeometry(r, texelSize), [texelSize]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
}
