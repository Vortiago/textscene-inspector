/**
 * Renders a Godot MultiMeshInstance3D: the MultiMesh's mesh once for each drawn instance, through
 * the surfaced mesh drawer. A node with no MultiMesh, or one with no mesh, draws nothing.
 */

import { useMemo, useRef } from 'react';
import type * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { FrameAabb } from '../../../r3f/components/NodeAabb';
import { useMeshContent } from '../../../r3f/meshes/meshContent';
import { SurfacedMeshDrawer } from '../../../r3f/surfacedMeshDrawer/SurfacedMeshDrawer';
import { useGeometryInstance } from '../../../r3f/visibilityRange/geometryInstance';
import { boxPlacement } from '../../../r3f/visibilityRange/placements';
import { useResourceResolution } from '../../../resources/useSubOrExtResource';
import { Node3D } from '../../base/node3d/Component';
import { multiMeshInstances } from './multiMeshInstances';
import { useMultiMeshAabb, useNodeMultiMesh } from './ownAabb';

export function MultiMeshInstance3D({ node, children }: NodeComponentProps) {
  const nodeRef = useRef<THREE.Group | null>(null);
  const { multiMesh, resources } = useNodeMultiMesh(node);
  // The instance culls by the box of the MultiMesh, as Godot does (`renderer_scene_cull.cpp:1996`).
  const ownAabb = useMultiMeshAabb(node, multiMesh, resources);
  const placement = useMemo(() => boxPlacement(nodeRef, ownAabb), [ownAabb]);
  useGeometryInstance(placement);

  const content = useMeshContent(useResourceResolution(multiMesh?.mesh, resources));
  const instances = useMemo(() => multiMesh && multiMeshInstances(multiMesh.drawn), [multiMesh]);
  return (
    <Node3D node={node} ref={nodeRef}>
      {ownAabb && <FrameAabb aabb={ownAabb} />}
      {instances && content.kind === 'surfaced' && (
        <SurfacedMeshDrawer parts={content.mesh.parts} instances={instances} />
      )}
      {children}
    </Node3D>
  );
}
