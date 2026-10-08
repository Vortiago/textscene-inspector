/**
 * <CSGCylinder3D>: renders a Godot CSGCylinder3D as a solid cylinder, or a cone when `cone` is
 * set. `<CsgPrimitive>` owns geometry, materials and the boolean seam, and builds the solid from
 * this slice's registered builder (`csgGeometry.ts`), the one the evaluator calls, so the shape
 * drawn alone and the shape contributed to a boolean cannot drift apart.
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CsgPrimitive } from '../CsgPrimitive';
import type { CSGCylinder3DProperties } from './types';
import { withGeometryInstance } from '../../../../r3f/visibilityRange/geometryInstance';

function CSGCylinder3DDrawer({ node, children }: NodeComponentProps) {
  return (
    <CsgPrimitive node={node} properties={node.properties as CSGCylinder3DProperties}>
      {children}
    </CsgPrimitive>
  );
}

export const CSGCylinder3D = withGeometryInstance(CSGCylinder3DDrawer);
