/**
 * <SoftBody3D>: a MeshInstance3D that draws its rest mesh (ADR-0005), plus Godot's wireframe gizmo
 * for every node, faint while unselected (ADR-0056): the triangle edges of every surface, nothing
 * without a mesh (`soft_body_3d_gizmo_plugin.cpp:62-97`).
 */

import { useMemo } from 'react';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import { PluginGizmo } from '../../../../r3f/gizmo/PluginGizmo';
import { meshDebugLines } from '../../../../r3f/meshes/meshDebugLines';
import type { SurfacedMesh } from '../../../../r3f/meshes/meshContent';
import { MeshInstance3D } from '../../../3d/meshinstance3d/Component';
import { CollisionDebugLines } from '../../shared/CollisionDebugLines';

function Wireframe({ mesh }: { mesh: SurfacedMesh }) {
  const positions = useMemo(() => meshDebugLines(mesh), [mesh]);
  return <CollisionDebugLines positions={positions} />;
}

export function SoftBody3D({ node, children }: NodeComponentProps) {
  return (
    <MeshInstance3D
      node={node}
      gizmo={(mesh) => (
        <PluginGizmo drawnFor="every-node">
          <Wireframe mesh={mesh} />
        </PluginGizmo>
      )}
    >
      {children}
    </MeshInstance3D>
  );
}
