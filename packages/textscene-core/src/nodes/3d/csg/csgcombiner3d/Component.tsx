/**
 * <CSGCombiner3D> — a grouping node whose shape is the boolean fold of its children.
 *
 * Godot's combiner has no solid: `_build_brush()` returns an empty brush
 * (csg_shape.cpp:1072). It exists so a set of CSG children folds into one result, which
 * then combines into ITS parent by its own `operation`. Its registration carries
 * `geometry: null`, so `<CsgPrimitive>` builds nothing for it.
 *
 * It still routes through `<CsgPrimitive>` because that is where a CSG ROOT is detected
 * and evaluated. A combiner under a plain Node3D is the commonest root there is, and
 * rendering it as a bare `<Node3D>` would leave each of its children to draw itself as a
 * separate lone root, silently skipping the boolean entirely.
 *
 * Registering the type also fixes something visible without any booleans: an unregistered
 * CSGCombiner3D falls through to GenericNodeFallback, which applies no `visible`, so a
 * HIDDEN combiner's children keep drawing. `ragdoll_physics.tscn:92` hides its combiner
 * precisely because the same geometry is already baked into sibling nodes.
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { CsgPrimitive } from '../CsgPrimitive';
import type { CSGCombiner3DProperties } from './types';

export function CSGCombiner3D({ node, children }: NodeComponentProps) {
  return (
    <CsgPrimitive node={node} properties={node.properties as CSGCombiner3DProperties}>
      {children}
    </CsgPrimitive>
  );
}
