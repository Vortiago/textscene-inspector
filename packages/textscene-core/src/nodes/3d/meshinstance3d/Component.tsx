/**
 * Renders a Godot MeshInstance3D as an R3F <mesh>: the geometry `useMeshContent` reads,
 * or a magenta wireframe placeholder for a GLB, a mesh type no slice builds, or an
 * unresolvable mesh. A node with no `mesh` draws nothing.
 * Each surface draws through `<InstancePasses>`, whose slots own the magenta
 * missing-texture placeholder. A node bound to a Skeleton3D draws its triangles as a THREE.SkinnedMesh.
 */

import * as THREE from 'three';
import { useMemo, useRef, type ReactNode, type RefObject } from 'react';
import type { MeshInstance3DProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import {
  node3dGroupSpread,
  transformFromNode3DProperties,
  type NodeTransform,
} from '../../../r3f/nodeTransform';
import { useSceneResources, type SceneResources } from '../../../r3f/SceneResourcesContext';
import { useResourceResolution } from '../../../resources/useSubOrExtResource';
import {
  drawnTag,
  useMeshContent,
  type SurfacedMesh,
  type SurfacedPart,
} from '../../../r3f/meshes/meshContent';
import { geometryDrawsPoints } from '../../../resources/meshes/godotSurface';
import { resolveMaterialSource, type MaterialSource } from '../../../r3f/materials/materialSource';
import { InstancePasses } from '../../../r3f/materials/InstancePasses';
import { drawnElementOf } from '../../../r3f/materials/nextPass';
import { isOutgrownBySkin, useSkinSkeleton } from '../../../r3f/meshes/skinSkeleton';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { useMeshSkin } from './useMeshSkin';
import { wireGizmoProgram } from '../../../r3f/components/wireGizmoProgram';
import { visualLayersUserData } from '../../../r3f/visualLayers';
import { drawHookProps, type ShadowCastingEffects } from '../../../r3f/shadowCasting';
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

export function MeshInstance3D({ node, children, gizmo }: MeshInstance3DProps) {
  const properties = node.properties as MeshInstance3DProperties;
  const pools = useSceneResources();

  const transform = useMemo(() => transformFromNode3DProperties(properties), [properties]);

  // A `.glb` resolves to nothing and falls through to the placeholder.
  const content = useMeshContent(useResourceResolution(properties.mesh, pools));

  // `surface_material_override/N`, keyed by the mesh's own surface numbering. Godot applies them
  // to every kind of mesh alike.
  const surfaceOverrides = useMemo(
    () => resolveSurfaceOverrides(properties.surfaceMaterialOverrides, pools),
    [properties.surfaceMaterialOverrides, pools]
  );

  // The ref lands on whichever `<mesh>` or `<points>` MeshShell renders, for the instance's passes to share.
  const meshRef = useRef<DrawnMesh | null>(null);

  // GeometryInstance3D's, so it reaches every surface this node draws, the overlay's too.
  // `cast_shadow`, the range cull and each surface's billboard and shadow-pass membership reach
  // three per draw group, through hooks that read that group's material.
  // The box covers every part, not the shell's alone, as Godot's does.
  const drawnParts = content.kind === 'surfaced' ? content.mesh.parts : NO_PARTS;
  const placement = useMemo(
    () =>
      partsPlacement(
        meshRef,
        drawnParts.map((part) => part.geometry)
      ),
    [drawnParts]
  );
  // The placeholder box is not the mesh's, so the cull cannot measure the instance.
  const shadow = useGeometryInstance(content.kind === 'unresolved' ? UNPLACED : placement);

  // The shell is the mesh's first part, which draws triangles when the mesh has any.
  const drawsPoints = content.kind === 'surfaced' && geometryDrawsPoints(content.mesh.parts[0].geometry);
  const skin = useMeshSkin(properties, useNodePath());
  const bindCount = skin?.matrices.length ?? 0;
  // The instance has no bounds only where every surface of every part outgrows the skin.
  const isOutgrown = useMemo(
    () => drawnParts.length > 0 && drawnParts.every((part) => isOutgrownBySkin(part.geometry, bindCount)),
    [drawnParts, bindCount]
  );
  // A surface with no bone arrays stays unskinned even when the node is bound.
  const skeleton = useSkinSkeleton(isOutgrown ? undefined : drawnParts[0]?.geometry, skin);

  const shellProps = {
    name: node.name,
    meshRef,
    drawsPoints,
    skeleton,
    transform,
    shadow,
    godotLayers: properties.layers,
    subtree:
      gizmo && content.kind === 'surfaced' ? (
        <>
          {gizmo(content.mesh)}
          {children}
        </>
      ) : (
        children
      ),
  };

  switch (content.kind) {
    case 'unresolved':
      return <MeshShell {...shellProps}>{UNRESOLVED_MESH}</MeshShell>;
    // While it loads, the shell keeps the node's descendants mounted: they do not depend on
    // the `.tres`. A node with no mesh, and a mesh Godot builds no surface for, draw nothing and
    // their descendants still mount. Their `get_aabb()` is `AABB()`, a point to frame on.
    case 'loading':
      return <MeshShell {...shellProps}>{null}</MeshShell>;
    case 'none':
    case 'empty':
      return (
        <MeshShell {...shellProps}>
          <FramePoint />
        </MeshShell>
      );
    case 'surfaced': {
      // The skin leaves the instance without bounds, so Godot places none of its surfaces.
      if (isOutgrown) return <MeshShell {...shellProps}>{null}</MeshShell>;
      const { parts } = content.mesh;
      return (
        <MeshShell {...shellProps}>
          <MeshSurfaces part={parts[0]} overrides={surfaceOverrides} meshRef={meshRef} skeleton={skeleton} />
          {parts.slice(1).map((part, i) => (
            <FollowingPart
              key={i}
              part={part}
              overrides={surfaceOverrides}
              shadow={shadow}
              godotLayers={properties.layers}
            />
          ))}
        </MeshShell>
      );
    }
  }
}

const NO_PARTS: readonly SurfacedPart[] = [];

interface MeshShellProps {
  name: string;
  /** Ref to the underlying THREE.Mesh or THREE.Points, whose geometry the overlay draws again. */
  meshRef: RefObject<DrawnMesh | null>;
  /** The mesh draws `PRIMITIVE_POINTS`, so the shell mounts `<points>`. */
  drawsPoints: boolean;
  /** The skeleton that skins the shell's surfaces, or null for an unskinned draw. */
  skeleton: THREE.Skeleton | null;
  transform: NodeTransform;
  /** `cast_shadow`, with the per-surface draw hooks: billboard, shadow pass, SHADOWS_ONLY. */
  shadow: ShadowCastingEffects;
  /** `layers`: the VisualInstance3D render mask a Decal's and a ReflectionProbe's masks test. */
  godotLayers: number;
  /** The dispatched scene-tree subtree parented under this MeshInstance3D. */
  subtree: ReactNode;
  children: ReactNode;
}

/**
 * The attribute shell every `<mesh>` branch of MeshInstance3D shares.
 * `children` is the branch's geometry and material. `subtree` is the node's
 * descendants, inside the mesh so they inherit its transform. Every branch,
 * placeholders included, passes it, or the descendants vanish with the mesh.
 */
function MeshShell({
  name,
  meshRef,
  drawsPoints,
  skeleton,
  transform,
  shadow,
  godotLayers,
  subtree,
  children,
}: MeshShellProps) {
  const { Drawn, skin } = drawnElementOf(drawsPoints, skeleton);
  return (
    <Drawn
      {...skin}
      ref={meshRef}
      name={name}
      {...node3dGroupSpread(transform)}
      {...drawHookProps(shadow)}
      // Godot's `layers`, for the decal and probe masks. Set on every branch, placeholders
      // included, so a decal's receiver test never depends on load order.
      userData={visualLayersUserData(godotLayers)}
    >
      {children}
      {/* Not `visible = false` for SHADOWS_ONLY: `WebGLShadowMap.renderObject` would skip
          the shadow pass and the subtree. The hooks skip each colour draw instead. */}
      {subtree}
    </Drawn>
  );
}

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
 * A part's geometry and the passes its instance draws it in. Godot sizes the override array to the
 * surface count (`scene/3d/mesh_instance_3d.cpp:68,407`), so the draw groups set the slot count and
 * an extra override is dropped: a PrimitiveMesh takes only surface 0's.
 */
function MeshSurfaces({
  part,
  overrides,
  meshRef,
  skeleton,
}: {
  part: SurfacedPart;
  overrides: SurfaceOverrides;
  /** The part's own draw, whose geometry every extra draw shares. */
  meshRef: RefObject<DrawnMesh | null>;
  /** The skeleton that skins the shell's surfaces, or null for an unskinned draw. */
  skeleton?: THREE.Skeleton | null;
}) {
  const groupCount = Math.max(part.surfaceIndices.length, 1);
  // The surface override stands over the mesh's material (`render_forward_clustered.cpp:4264`),
  // as `MeshInstance3D::get_active_material` restates (`mesh_instance_3d.cpp:384`).
  const sources = Array.from(
    { length: groupCount },
    (_unused, i) => overrides.get(part.surfaceIndices[i] ?? i) ?? part.materials[i]
  );
  return (
    <>
      <primitive object={part.geometry} attach="geometry" />
      <InstancePasses
        meshRef={meshRef}
        sources={sources}
        drawsPoints={geometryDrawsPoints(part.geometry)}
        skeleton={skeleton}
      />
    </>
  );
}

/**
 * A part after the shell's own: the points of a mesh that also has triangles. A child of the shell,
 * so it shares the node's transform and its subtree stays under one object. It carries its own
 * overlay, as Godot draws the overlay over every surface.
 */
function FollowingPart({
  part,
  overrides,
  shadow,
  godotLayers,
}: {
  part: SurfacedPart;
  overrides: SurfaceOverrides;
  shadow: ShadowCastingEffects;
  godotLayers: number;
}) {
  const ref = useRef<DrawnMesh | null>(null);
  const Drawn = drawnTag(geometryDrawsPoints(part.geometry));
  return (
    <Drawn ref={ref} {...drawHookProps(shadow)} userData={visualLayersUserData(godotLayers)}>
      <MeshSurfaces part={part} overrides={overrides} meshRef={ref} />
    </Drawn>
  );
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
