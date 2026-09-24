/**
 * <CSGCombiner3D>: a grouping node whose shape is the boolean fold of its children, which then
 * combines into its parent by its own `operation`. Godot's combiner has no solid
 * (`_build_brush()` returns an empty brush, csg_shape.cpp:1072), so its registration carries
 * `geometry: null` and `<CsgPrimitive>` builds nothing for it.
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CsgPrimitive } from '../CsgPrimitive';
import type { CSGCombiner3DProperties } from './types';

// Routed through `<CsgPrimitive>`, where a CSG root is detected and evaluated: a combiner under a
// plain Node3D is the commonest root, and a bare `<Node3D>` would draw each child as a lone root.
// The registration also applies `visible`, which GenericNodeFallback ignores, so a hidden combiner
// (a real authoring pattern when siblings bake its geometry) hides its children.
export function CSGCombiner3D({ node, children }: NodeComponentProps) {
  return (
    <CsgPrimitive node={node} properties={node.properties as CSGCombiner3DProperties}>
      {children}
    </CsgPrimitive>
  );
}
