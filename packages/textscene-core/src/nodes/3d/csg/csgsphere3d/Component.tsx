/**
 * <CSGSphere3D>: renders a Godot CSGSphere3D as a solid sphere. `<CsgPrimitive>` owns geometry,
 * materials and the boolean seam, and builds the solid from this slice's registered builder
 * (`csgGeometry.ts`), the one the evaluator calls, so the shape drawn alone and the shape
 * contributed to a boolean cannot drift apart.
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CsgPrimitive } from '../CsgPrimitive';
import type { CSGSphere3DProperties } from './types';

export function CSGSphere3D({ node, children }: NodeComponentProps) {
  return (
    <CsgPrimitive node={node} properties={node.properties as CSGSphere3DProperties}>
      {children}
    </CsgPrimitive>
  );
}
