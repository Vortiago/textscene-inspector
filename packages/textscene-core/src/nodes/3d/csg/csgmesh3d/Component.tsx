/**
 * <CSGMesh3D> — renders a Godot CSGMesh3D as the solid described by its `mesh` resource.
 *
 * Reuses MeshInstance3D's geometry resolution and NOTHING of its material pipeline. That
 * asymmetry is Godot's, not a shortcut: `CSGMesh3D.material` is a single material that
 * replaces the mesh's own (csg_shape.cpp:1167-1172), with no `surface_material_override/N`
 * concept, so the eight texture slots, UV transform, triplanar scaling and billboard
 * machinery in the MeshInstance3D slice have nothing to attach to here. Material handling
 * comes from `<CsgPrimitive>`, exactly as it does for CSGBox3D.
 *
 * A missing or unresolvable `mesh` renders empty geometry rather than a placeholder:
 * Godot builds an empty brush for a CSGMesh3D with no mesh (csg_shape.cpp:1126), so an
 * empty solid IS the parity-correct picture.
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { findSubResource, useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { parseResourceReference } from '../../../../resources/SubResourceResolver';
import {
  buildPrimitiveMeshGeometry,
  primitiveMeshGeometryKey,
} from '../../meshinstance3d/primitiveMeshGeometry';
import { CsgPrimitive } from '../CsgPrimitive';
import type { CSGMesh3DProperties } from './types';

export function CSGMesh3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CSGMesh3DProperties;
  const { internalResources } = useSceneResources();

  const resource = useMemo(() => {
    if (!properties.mesh) return undefined;
    const ref = parseResourceReference(properties.mesh);
    // An ExtResource mesh is a `.tres` ArrayMesh or a `.glb`; neither resolves
    // synchronously, so both fall through to empty geometry for now.
    if (!ref || ref.type !== 'SubResource') return undefined;
    return findSubResource(internalResources, ref.id);
  }, [properties.mesh, internalResources]);

  // Keyed on the resource's content, not its identity, for the reason documented in
  // primitiveMeshGeometry.ts: identity churns on every reparse.
  const key = resource ? primitiveMeshGeometryKey(resource) : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` IS the content of `resource`.
  const geometry = useMemo(() => (resource ? buildPrimitiveMeshGeometry(resource) : null), [key]);

  return (
    <CsgPrimitive
      node={node}
      properties={properties}
      geometry={geometry ? <primitive object={geometry} attach="geometry" /> : null}
    >
      {children}
    </CsgPrimitive>
  );
}
