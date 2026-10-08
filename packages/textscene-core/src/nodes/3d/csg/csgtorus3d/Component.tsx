/**
 * <CSGTorus3D>: renders a Godot CSGTorus3D as a solid ring. `<CsgPrimitive>` owns geometry,
 * materials and the boolean seam, and builds the solid from this slice's registered builder
 * (`csgGeometry.ts`), the one the evaluator calls, so the shape drawn alone and the shape
 * contributed to a boolean cannot drift apart.
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CsgPrimitive } from '../CsgPrimitive';
import type { CSGTorus3DProperties } from './types';

export function CSGTorus3D({ node, children }: NodeComponentProps) {
  return (
    <CsgPrimitive node={node} properties={node.properties as CSGTorus3DProperties}>
      {children}
    </CsgPrimitive>
  );
}
