/**
 * `<GeometryInstance3D>`: a GeometryInstance3D the previewer does not draw. It mounts the Node3D
 * transform, and holds the node's place in the scene cull, so its visibility range still decides
 * its visibility dependants.
 */

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { Node3D } from '../../base/node3d/Component';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { boxPlacement } from '../../../r3f/visibilityRange/placements';
import { useGeometryInstance, withGeometryInstance } from '../../../r3f/visibilityRange/geometryInstance';
import type { Particles3DProperties } from '../particles/types';

function UndrawnGeometryInstance({ node, children }: NodeComponentProps) {
  const nodeRef = useRef<THREE.Group | null>(null);
  // The only box an undrawn instance's data gives is a particle emitter's `visibility_aabb`.
  const visibilityAabb = (node.properties as Partial<Particles3DProperties>).visibilityAabb ?? null;
  const placement = useMemo(() => boxPlacement(nodeRef, visibilityAabb), [visibilityAabb]);
  useGeometryInstance(placement);
  return (
    <Node3D node={node} ref={nodeRef}>
      {children}
    </Node3D>
  );
}

export const GeometryInstance3D = withGeometryInstance(UndrawnGeometryInstance);
