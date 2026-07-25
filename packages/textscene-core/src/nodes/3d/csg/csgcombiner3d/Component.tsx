/**
 * <CSGCombiner3D> — a grouping node that draws nothing of its own.
 *
 * Godot's combiner has no shape: `_build_brush()` returns an empty brush
 * (csg_shape.cpp:1072). It exists so a set of CSG children can be folded into one solid
 * and then combined into ITS parent by its own `operation`. So this renders as a plain
 * transform group, and `<Node3D>` already is one.
 *
 * Registering the type is not a formality even before boolean evaluation lands. An
 * unregistered CSGCombiner3D falls through to `<GenericNodeFallback>`, which does not
 * apply `visible`, so a hidden combiner's children keep drawing. That is a real corpus
 * case: `scenes/demos/3d/ragdoll_physics/ragdoll_physics.tscn:92` hides its combiner
 * precisely because the same geometry is already baked into sibling nodes.
 */

import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../../base/node3d/Component';

export function CSGCombiner3D({ node, children }: NodeComponentProps) {
  return <Node3D node={node}>{children}</Node3D>;
}
