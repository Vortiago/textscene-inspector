/**
 * Renders a Godot MeshInstance3D through the surfaced mesh drawer: the geometry `useMeshContent`
 * reads, or a magenta wireframe placeholder for a GLB, a mesh type no slice builds, or an
 * unresolvable mesh. A node with no `mesh` draws nothing. A node bound to a Skeleton3D draws its
 * triangles as a THREE.SkinnedMesh.
 */

import * as THREE from 'three';
import { useMemo, useRef, type ReactNode } from 'react';
import type { MeshInstance3DProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useSceneResources, type SceneResources } from '../../../r3f/SceneResourcesContext';
import { useResourceResolution } from '../../../resources/useSubOrExtResource';
import { useMeshContent, type SurfacedMesh, type SurfacedPart } from '../../../r3f/meshes/meshContent';
import { resolveMaterialSource, type MaterialSource } from '../../../r3f/materials/materialSource';
import { SurfacedMeshDrawer, type MeshPart } from '../../../r3f/surfacedMeshDrawer/SurfacedMeshDrawer';
import { isOutgrownBySkin, useSkinSkeleton } from '../../../r3f/meshes/skinSkeleton';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useMeshSkin } from './useMeshSkin';
import { wireGizmoProgram } from '../../../r3f/components/wireGizmoProgram';
import { FramePoint } from '../../../r3f/components/NodeAabb';
import { useGeometryInstance } from '../../../r3f/visibilityRange/geometryInstance';
import { partsPlacement, UNPLACED } from '../../../r3f/visibilityRange/placements';

/** What a MeshInstance3D mounts: a mesh draws triangles, a PointMesh draws points. */
type DrawnMesh = THREE.Mesh | THREE.Points;

/** Literal-only, so its key is constant and it never remounts. */
const UNRESOLVED_MESH_MATERIAL = wireGizmoProgram(0xff00ff);

interface MeshInstance3DProps extends NodeComponentProps {
  /**
   * A subclass's editor gizmo. It mounts inside the mesh object, so it takes the node's transform, and
   * only for a mesh that resolved, with the surfaces this node draws: no second decode.
   */
  gizmo?: (mesh: SurfacedMesh) => ReactNode;
}

/**
 * The mesh a node's `mesh` property names, as the surfaces a draw mounts. MeshInstance2D reads it
 * through here too, so the lookup of a mesh moves with this one entry.
 */
export function useMeshInstanceContent(meshRef: string | undefined, pools: SceneResources) {
  return useMeshContent(useResourceResolution(meshRef, pools));
}

export function MeshInstance3D({ node, children, gizmo }: MeshInstance3DProps) {
  const properties = node.properties as MeshInstance3DProperties;
  const pools = useSceneResources();

  const transform = useMemo(() => transformFromNode3DProperties(properties), [properties]);

  // A `.glb` resolves to nothing and falls through to the placeholder.
  const content = useMeshInstanceContent(properties.mesh, pools);

  // `surface_material_override/N`, keyed by the mesh's own surface numbering. Godot applies them
  // to every kind of mesh alike.
  const surfaceOverrides = useMemo(
    () => resolveSurfaceOverrides(properties.surfaceMaterialOverrides, pools),
    [properties.surfaceMaterialOverrides, pools]
  );

  // The ref lands on the body the drawer mounts, which the instance's placement measures.
  const meshRef = useRef<DrawnMesh | null>(null);

  // The box covers every part, not the body's alone, as Godot's does.
  const drawnParts = content.kind === 'surfaced' ? content.mesh.parts : NO_SURFACED_PARTS;
  const placement = useMemo(
    () =>
      partsPlacement(
        meshRef,
        drawnParts.map((part) => part.geometry)
      ),
    [drawnParts]
  );
  // The placeholder box is not the mesh's, so the cull cannot measure the instance.
  useGeometryInstance(content.kind === 'unresolved' ? UNPLACED : placement);

  const skin = useMeshSkin(properties, useNodePath());
  const bindCount = skin?.matrices.length ?? 0;
  // The instance has no bounds only where every surface of every part outgrows the skin.
  const isOutgrown = useMemo(
    () => drawnParts.length > 0 && drawnParts.every((part) => isOutgrownBySkin(part.geometry, bindCount)),
    [drawnParts, bindCount]
  );
  // A surface with no bone arrays stays unskinned even when the node is bound.
  const skeleton = useSkinSkeleton(isOutgrown ? undefined : drawnParts[0]?.geometry, skin);

  const subtree =
    gizmo && content.kind === 'surfaced' ? (
      <>
        {gizmo(content.mesh)}
        {children}
      </>
    ) : (
      children
    );
  const parts = useMemo(
    () => drawnParts.map((part) => overriddenPart(part, surfaceOverrides)),
    [drawnParts, surfaceOverrides]
  );
  // One drawer in every branch: the body keeps the node's descendants mounted while the mesh
  // loads, since they do not depend on the `.tres`.
  return (
    <SurfacedMeshDrawer
      parts={parts}
      body={{ ref: meshRef, name: node.name, transform }}
      skeleton={skeleton}
      // The skin leaves the instance without bounds.
      isUnplaced={isOutgrown}
    >
      {content.kind === 'unresolved' && UNRESOLVED_MESH}
      {/* A node with no mesh, and a mesh Godot builds no surface for, hold `AABB()`: a point to frame on. */}
      {(content.kind === 'none' || content.kind === 'empty') && <FramePoint />}
      {subtree}
    </SurfacedMeshDrawer>
  );
}

const NO_SURFACED_PARTS: readonly SurfacedPart[] = [];

/**
 * What an unresolved mesh renders as: a failed external `.tres`, or a scene
 * sub-resource whose surfaces could not be read.
 */
const UNRESOLVED_MESH = (
  <>
    <boxGeometry args={[1, 1, 1]} />
    <meshBasicMaterial key={UNRESOLVED_MESH_MATERIAL.key} {...UNRESOLVED_MESH_MATERIAL.props} />
  </>
);

/**
 * `part` with each `surface_material_override/N` over the material of its surface
 * (`render_forward_clustered.cpp:4264`, `mesh_instance_3d.cpp:384`). Godot sizes the override array
 * to the surface count (`mesh_instance_3d.cpp:68,407`), so the draw groups set the slot count and
 * an extra override is dropped: a PrimitiveMesh takes only surface 0's.
 */
function overriddenPart(part: SurfacedPart, overrides: SurfaceOverrides): MeshPart {
  const groupCount = Math.max(part.surfaceIndices.length, 1);
  const materials = Array.from(
    { length: groupCount },
    (_unused, i) => overrides.get(part.surfaceIndices[i] ?? i) ?? part.materials[i]
  );
  return { geometry: part.geometry, materials };
}

/** `surface_material_override/N`, resolved against the scene and keyed by Godot's original surface index. */
type SurfaceOverrides = ReadonlyMap<number, MaterialSource>;

function resolveSurfaceOverrides(
  refs: MeshInstance3DProperties['surfaceMaterialOverrides'],
  scene: SceneResources
): SurfaceOverrides {
  const overrides = new Map<number, MaterialSource>();
  for (const [index, ref] of refs) {
    const source = resolveMaterialSource(ref, scene);
    if (source) overrides.set(index, source);
  }
  return overrides;
}
