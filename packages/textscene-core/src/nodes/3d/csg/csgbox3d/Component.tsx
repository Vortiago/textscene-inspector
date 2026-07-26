/**
 * <CSGBox3D> — renders a Godot CSGBox3D as a solid box.
 *
 * Geometry, materials and the boolean seam all live in `<CsgPrimitive>`, which builds the
 * solid from this slice's REGISTERED builder (see `csgGeometry.ts`). That is the same
 * builder the evaluator calls, so the shape a node draws alone and the shape it
 * contributes to a boolean cannot drift apart.
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CsgPrimitive } from '../CsgPrimitive';
import type { CSGBox3DProperties } from './types';

export function CSGBox3D({ node, children }: NodeComponentProps) {
  return (
    <CsgPrimitive node={node} properties={node.properties as CSGBox3DProperties}>
      {children}
    </CsgPrimitive>
  );
}
