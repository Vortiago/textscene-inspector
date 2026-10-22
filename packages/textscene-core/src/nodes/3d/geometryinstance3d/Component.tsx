/**
 * A GeometryInstance3D the previewer does not draw. It mounts the Node3D transform, and holds the
 * node's place in the scene cull, so its visibility range still decides its visibility dependants.
 * Each type gives the box its Godot base gives the instance.
 */

import { useMemo, useRef, type ComponentType } from 'react';
import type * as THREE from 'three';
import { Node3D } from '../../base/node3d/Component';
import type { NodeComponent, NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { boxPlacement } from '../../../r3f/visibilityRange/placements';
import { useGizmoVisible } from '../../../r3f/hooks/useGizmoVisible';
import { invisibleBase } from '../../../r3f/invisibleBase';
import { useGeometryInstance } from '../../../r3f/visibilityRange/geometryInstance';
import type { TscnNode } from '../../../parser/types';
import type { Aabb } from '../../../godot/math/aabb';

/**
 * The box the node's base gives its instance, in node space, or null while it is unknown. The
 * same object while the box holds, as the cull's placement is rebuilt on each new one.
 */
type UseOwnAabb = (node: TscnNode) => Aabb | null;

/** The component an undrawn GeometryInstance3D type registers, culled by the box `useOwnAabb` gives. */
export function undrawnGeometryInstance(useOwnAabb: UseOwnAabb): NodeComponent {
  function UndrawnGeometryInstance({ node, children }: NodeComponentProps) {
    const nodeRef = useRef<THREE.Group | null>(null);
    const ownAabb = useOwnAabb(node);
    const placement = useMemo(() => boxPlacement(nodeRef, ownAabb), [ownAabb]);
    useGeometryInstance(placement);
    return (
      <Node3D node={node} ref={nodeRef}>
        {children}
      </Node3D>
    );
  }
  return invisibleBase(UndrawnGeometryInstance);
}

/**
 * An undrawn GeometryInstance3D that carries its editor gizmos while it is selected (ADR-0018).
 * `Gizmos` reads the node's properties, which are `Properties` for the type that registers it.
 */
export function undrawnGeometryInstanceWithGizmos<Properties>(
  useOwnAabb: UseOwnAabb,
  Gizmos: ComponentType<{ properties: Properties }>
): NodeComponent {
  const Undrawn = undrawnGeometryInstance(useOwnAabb);
  function UndrawnGeometryInstanceWithGizmos({ node, children }: NodeComponentProps) {
    const gizmoVisible = useGizmoVisible();
    return (
      <Undrawn node={node}>
        {gizmoVisible && <Gizmos properties={node.properties as Properties} />}
        {children}
      </Undrawn>
    );
  }
  return invisibleBase(UndrawnGeometryInstanceWithGizmos);
}

/** A bare GeometryInstance3D gives its instance no base (`godot/scene/geometryBase.ts`), so no box. */
export const GeometryInstance3D = undrawnGeometryInstance(() => null);
