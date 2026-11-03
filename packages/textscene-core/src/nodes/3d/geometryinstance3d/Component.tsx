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
import type { GizmoDrawnFor } from '../../../r3f/hooks/useGizmoState';
import { PluginGizmo } from '../../../r3f/gizmo/PluginGizmo';
import { invisibleBase } from '../../../r3f/invisibleBase';
import { useGeometryInstance } from '../../../r3f/visibilityRange/geometryInstance';
import type { TscnNode } from '../../../parser/types';
import type { Aabb } from '../../../godot/math/aabb';
import { FrameAabb } from '../../../r3f/components/FrameAabb';

/**
 * The box the node's base gives its instance, in node space, or null while it is unknown. The
 * same object while the box holds, as the cull's placement is rebuilt on each new one.
 */
type UseOwnAabb = (node: TscnNode) => Aabb | null;

/**
 * The component an undrawn GeometryInstance3D type registers, culled by the box `useOwnAabb` gives
 * and framed on the box `useGetAabb` gives. Those are one box unless the type's `get_aabb()` differs
 * from its instance box, as a particle emitter's does.
 */
export function undrawnGeometryInstance(
  useOwnAabb: UseOwnAabb,
  useGetAabb: UseOwnAabb = useOwnAabb
): NodeComponent {
  function UndrawnGeometryInstance({ node, children }: NodeComponentProps) {
    const nodeRef = useRef<THREE.Group | null>(null);
    const ownAabb = useOwnAabb(node);
    const getAabb = useGetAabb(node);
    const placement = useMemo(() => boxPlacement(nodeRef, ownAabb), [ownAabb]);
    useGeometryInstance(placement);
    return (
      <Node3D node={node} ref={nodeRef}>
        {getAabb && <FrameAabb aabb={getAabb} />}
        {children}
      </Node3D>
    );
  }
  return invisibleBase(UndrawnGeometryInstance);
}

/** What `undrawnGeometryInstanceWithGizmos` mounts: the type's gizmos, inside a `PluginGizmo`. */
export interface GeometryInstanceGizmosProps<Properties> {
  /** The node's properties, which are `Properties` for the type that registers the gizmos. */
  properties: Properties;
}

/**
 * An undrawn GeometryInstance3D that carries its editor gizmos (ADR-0056). `drawnFor` says which
 * nodes Godot draws the gizmo plugin for. `Gizmos` is mounted for those nodes, and mounts the parts
 * that only a selected gizmo has in a selected-only `PluginGizmo` of their own.
 */
export function undrawnGeometryInstanceWithGizmos<Properties>(
  useOwnAabb: UseOwnAabb,
  useGetAabb: UseOwnAabb,
  Gizmos: ComponentType<GeometryInstanceGizmosProps<Properties>>,
  drawnFor: GizmoDrawnFor
): NodeComponent {
  const Undrawn = undrawnGeometryInstance(useOwnAabb, useGetAabb);
  function UndrawnGeometryInstanceWithGizmos({ node, children }: NodeComponentProps) {
    return (
      <Undrawn node={node}>
        <PluginGizmo drawnFor={drawnFor}>
          <Gizmos properties={node.properties as Properties} />
        </PluginGizmo>
        {children}
      </Undrawn>
    );
  }
  return invisibleBase(UndrawnGeometryInstanceWithGizmos);
}

/** A bare GeometryInstance3D gives its instance no base (`godot/scene/geometryBase.ts`), so no box. */
export const GeometryInstance3D = undrawnGeometryInstance(() => null);
