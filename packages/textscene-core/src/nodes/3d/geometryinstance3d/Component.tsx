/**
 * A GeometryInstance3D the previewer does not draw. It mounts the Node3D transform, and holds the
 * node's place in the scene cull, so its visibility range still decides its visibility dependants.
 * Each type gives the box its Godot base gives the instance.
 */

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { Node3D } from '../../base/node3d/Component';
import type { NodeComponent, NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { boxPlacement } from '../../../r3f/visibilityRange/placements';
import { useGeometryInstance, withGeometryInstance } from '../../../r3f/visibilityRange/geometryInstance';
import type { TscnNode } from '../../../parser/types';
import type { Aabb } from '../../../godot/aabb';

/**
 * The box the node's base gives its instance, in node space, or null while it is unknown. The
 * same object while the box holds, as the cull's placement is rebuilt on each new one.
 */
export type UseOwnAabb = (node: TscnNode) => Aabb | null;

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
  return withGeometryInstance(UndrawnGeometryInstance);
}

/** A bare GeometryInstance3D gives its instance no base (`godot/geometryBase.ts`), so no box. */
export const GeometryInstance3D = undrawnGeometryInstance(() => null);
