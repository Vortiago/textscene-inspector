/**
 * <CSGMesh3D>: renders a Godot CSGMesh3D as the solid its `mesh` resource describes.
 * `<CsgPrimitive>` owns geometry, materials and the boolean seam, and builds the solid from this
 * slice's registered builder (`csgGeometry.ts`), the one the evaluator calls, so the shape drawn
 * alone and the shape contributed to a boolean cannot drift apart.
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { useUndrawnMeshReport } from '../../../../r3f/contexts/UndrawnMeshesContext';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { useResourceResolution } from '../../../../resources/useSubOrExtResource';
import { CsgPrimitive } from '../CsgPrimitive';
import type { CSGMesh3DProperties } from './types';

export function CSGMesh3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CSGMesh3DProperties;
  useUndrawnMeshReport(
    useResourceResolution(properties.mesh, useSceneResources()).scoped?.resource.type ?? null
  );
  return (
    <CsgPrimitive node={node} properties={properties}>
      {children}
    </CsgPrimitive>
  );
}
