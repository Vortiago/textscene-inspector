/**
 * Renders a Godot MeshInstance3D as an R3F <mesh>: the geometry `useMeshContent` reads,
 * or a magenta wireframe placeholder for a GLB, a mesh type no slice builds, or an
 * unresolvable mesh. A node with no `mesh` draws nothing.
 * Each surface draws through `<SurfaceMaterialSlot>`, which owns the magenta
 * missing-texture placeholder. A node bound to a Skeleton3D draws its triangles as a THREE.SkinnedMesh.
 */

import * as THREE from 'three';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { MeshInstance3DProperties } from './types';
import type { TscnInternalResource } from '../../../parser/types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
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
import { SurfaceMaterialSlots } from '../../../r3f/materials/SurfaceMaterialSlots';
import { SurfaceMaterialSlot } from '../../../r3f/materials/SurfaceMaterialSlot';
import { useSkinSkeleton } from '../../../r3f/meshes/skinSkeleton';
import { useLiveScenePass } from '../../../r3f/liveScenePass';
import { useNodePath } from '../../../r3f/contexts/NodePathContext';
import { bindMeshesToSkeletons, namesSkeletonToBind } from '../skeleton3d/skeletonBindings';
import { wireGizmoProgram } from '../../../r3f/components/wireGizmoProgram';
import { visualLayersUserData } from '../../../r3f/visualLayers';
import { drawHookProps, type ShadowCastingEffects } from '../../../r3f/shadowCasting';
import { useGeometryInstance } from '../../../r3f/visibilityRange/geometryInstance';
import { partsPlacement, UNPLACED } from '../../../r3f/visibilityRange/placements';

/** What a MeshInstance3D mounts: a mesh draws triangles, a PointMesh draws points. */
type DrawnMesh = THREE.Mesh | THREE.Points;

/**
 * The element of the node's own draw and the props that bind it. A skeleton makes it a
 * THREE.SkinnedMesh, drawn detached so the skin matrices stay in mesh space and the node's
 * transform applies after them.
 */
function drawOf(drawsPoints: boolean, skeleton: THREE.Skeleton | null | undefined) {
  // A PointMesh stays `<points>`: a SkinnedMesh would draw its one index per point as triangles.
  return skeleton && !drawsPoints
    ? { Drawn: 'skinnedMesh' as const, skin: { skeleton, bindMode: THREE.DetachedBindMode } }
    : { Drawn: drawnTag(drawsPoints), skin: {} };
}

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

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  // A `.glb` resolves to nothing and falls through to the placeholder.
  const content = useMeshContent(useResourceResolution(properties.mesh, pools));

  // `material_override` and `surface_material_override/N`, keyed by the mesh's own surface
  // numbering. Godot applies them to every kind of mesh alike.
  const meshOverrides = useMemo(() => resolveMeshOverrides(properties, pools), [properties, pools]);

  // `material_overlay` never competes for a surface slot, so it resolves apart from the
  // overrides: it is drawn on its own.
  const overlaySource = useMemo(
    () => resolveMaterialSource(properties.materialOverlay, pools),
    [properties.materialOverlay, pools]
  );

  // The ref lands on whichever `<mesh>` or `<points>` MeshShell renders, for the overlay to share.
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
  // A surface with no bone arrays stays unskinned even when the node is bound.
  // A mesh that cannot bind asks with no path, so the pass never runs for a scene without one.
  const bindingPath = useNodePath();
  const skinMatrices = useLiveScenePass(
    bindMeshesToSkeletons,
    namesSkeletonToBind(properties) ? bindingPath : null
  );
  const skeleton = useSkinSkeleton(drawnParts[0]?.geometry, skinMatrices);

  const shellProps = {
    name: node.name,
    meshRef,
    drawsPoints,
    skeleton,
    position,
    rotation,
    scale,
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
    overlay: overlaySource ? (
      <MaterialOverlayMesh
        meshRef={meshRef}
        drawsPoints={drawsPoints}
        skeleton={skeleton}
        source={overlaySource}
        shadow={shadow}
      />
    ) : null,
  };

  switch (content.kind) {
    case 'unresolved':
      return (
        <MeshShell {...shellProps} overlay={null}>
          {UNRESOLVED_MESH}
        </MeshShell>
      );
    // While it loads, the shell keeps the node's descendants mounted: they do not depend on
    // the `.tres`. A node with no mesh, and a mesh Godot builds no surface for, draw nothing and
    // their descendants still mount.
    case 'none':
    case 'loading':
    case 'empty':
      return <MeshShell {...shellProps}>{null}</MeshShell>;
    case 'surfaced': {
      const { parts, primitive } = content.mesh;
      return (
        <MeshShell {...shellProps}>
          <MeshSurfaces part={parts[0]} primitive={primitive} overrides={meshOverrides} />
          {parts.slice(1).map((part, i) => (
            <FollowingPart
              key={i}
              part={part}
              primitive={primitive}
              overrides={meshOverrides}
              overlaySource={overlaySource}
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

/**
 * The overlay's draw-order key. Any value above the 3D default (0) puts it after
 * its own surface; 1 keeps it as close to that surface as three allows, since
 * every step also steps it past unrelated content at the same depth.
 */
const MATERIAL_OVERLAY_RENDER_ORDER = 1;

/** Opts a mesh out of picking: three calls `raycast` and collects nothing. */
const NO_RAYCAST: THREE.Object3D['raycast'] = () => {};

/**
 * `material_overlay`'s draw: the base mesh's geometry a second time, with the
 * overlay material. A separate mesh, not a material array entry: Godot's
 * overlay covers every surface (`_geometry_instance_add_surface` runs per
 * surface), and one material over a grouped geometry draws the same pixels.
 */
function MaterialOverlayMesh({
  meshRef,
  drawsPoints,
  skeleton,
  source,
  shadow,
}: {
  meshRef: RefObject<DrawnMesh | null>;
  /** The base draws points, so the overlay does too. */
  drawsPoints: boolean;
  /** The base is skinned, so the overlay is skinned by the same skeleton. */
  skeleton?: THREE.Skeleton | null;
  source: MaterialSource;
  /**
   * The base mesh's hooks. The overlay casts nothing of its own, so only the colour pair
   * mounts: its own material decides its billboard, and SHADOWS_ONLY skips its draw too.
   */
  shadow: ShadowCastingEffects;
}) {
  // Read back off the base mesh rather than built again, so all four geometry branches
  // share one component and the two meshes share one geometry.
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const readBack = () => {
    const attached = meshRef.current?.geometry ?? null;
    setGeometry((previous) => (previous === attached ? previous : attached));
  };
  // Dep-less, since a re-parse replaces the geometry and `[meshRef]` would keep the old
  // one. They cannot loop: the updater returns the same value when nothing moved. The
  // layout pass swaps a re-parsed geometry before paint. On mount it runs before React
  // attaches the parent mesh's ref, so the passive pass reads the first geometry.
  useLayoutEffect(readBack);
  useEffect(readBack);

  if (!geometry) return null;
  const { Drawn, skin } = drawOf(drawsPoints, skeleton);
  return (
    <Drawn
      {...skin}
      geometry={geometry}
      // Explicit: three breaks ties by creation order, so a re-parse that remounts one
      // material would draw the overlay under its surface. Godot appends the overlay
      // after the surface's own material chain.
      renderOrder={MATERIAL_OVERLAY_RENDER_ORDER}
      // The base mesh is the node's pickable body and the one `bounds.ts`
      // measures; a coincident second hit would report the same node twice.
      raycast={NO_RAYCAST}
      receiveShadow
      onBeforeRender={shadow.onBeforeRender}
      onAfterRender={shadow.onAfterRender}
    >
      <SurfaceMaterialSlot source={source} drawsPoints={drawsPoints} />
    </Drawn>
  );
}

interface MeshShellProps {
  name: string;
  /** Ref to the underlying THREE.Mesh or THREE.Points, whose geometry the overlay draws again. */
  meshRef: RefObject<DrawnMesh | null>;
  /** The mesh draws `PRIMITIVE_POINTS`, so the shell mounts `<points>`. */
  drawsPoints: boolean;
  /** The skeleton that skins the shell's surfaces, or null for an unskinned draw. */
  skeleton: THREE.Skeleton | null;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  /** `cast_shadow`, with the per-surface draw hooks: billboard, shadow pass, SHADOWS_ONLY. */
  shadow: ShadowCastingEffects;
  /** `layers`: the VisualInstance3D render mask a Decal's and a ReflectionProbe's masks test. */
  godotLayers: number;
  /** The dispatched scene-tree subtree parented under this MeshInstance3D. */
  subtree: ReactNode;
  /** `material_overlay`'s second draw of this same surface, if the node has one. */
  overlay: ReactNode;
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
  position,
  rotation,
  scale,
  shadow,
  godotLayers,
  subtree,
  overlay,
  children,
}: MeshShellProps) {
  const { Drawn, skin } = drawOf(drawsPoints, skeleton);
  return (
    <Drawn
      {...skin}
      ref={meshRef}
      name={name}
      position={position}
      rotation={rotation}
      scale={scale}
      {...drawHookProps(shadow)}
      // Godot's `layers`, for the decal and probe masks. Set on every branch, placeholders
      // included, so a decal's receiver test never depends on load order.
      userData={visualLayersUserData(godotLayers)}
    >
      {children}
      {/* Not `visible = false` for SHADOWS_ONLY: `WebGLShadowMap.renderObject` would skip
          the shadow pass and the subtree. The hooks skip each colour draw instead. */}
      {overlay}
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
 * A mesh's geometry plus a `<SurfaceMaterialSlots>` over its draw groups, so one hook per
 * component serves any surface count. Godot sizes the override array to the surface count
 * (`scene/3d/mesh_instance_3d.cpp:68,407`), so the draw groups set the slot count and an extra
 * override is dropped: a PrimitiveMesh takes only surface 0's.
 */
function MeshSurfaces({
  part,
  primitive,
  overrides,
}: {
  part: SurfacedPart;
  primitive: TscnInternalResource | undefined;
  overrides: MeshOverrides;
}) {
  const groupCount = Math.max(part.surfaceIndices.length, 1);
  const sources = Array.from({ length: groupCount }, (_unused, i) =>
    effectiveMaterialSource(overrides, part.surfaceIndices[i] ?? i, part.materials[i])
  );
  return (
    <>
      <primitive object={part.geometry} attach="geometry" />
      <SurfaceMaterialSlots
        sources={sources}
        triplanarMesh={primitive}
        drawsPoints={geometryDrawsPoints(part.geometry)}
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
  primitive,
  overrides,
  overlaySource,
  shadow,
  godotLayers,
}: {
  part: SurfacedPart;
  primitive: TscnInternalResource | undefined;
  overrides: MeshOverrides;
  overlaySource: MaterialSource | undefined;
  shadow: ShadowCastingEffects;
  godotLayers: number;
}) {
  const ref = useRef<DrawnMesh | null>(null);
  const drawsPoints = geometryDrawsPoints(part.geometry);
  const Drawn = drawnTag(drawsPoints);
  return (
    <Drawn ref={ref} {...drawHookProps(shadow)} userData={visualLayersUserData(godotLayers)}>
      <MeshSurfaces part={part} primitive={primitive} overrides={overrides} />
      {overlaySource && (
        <MaterialOverlayMesh meshRef={ref} drawsPoints={drawsPoints} source={overlaySource} shadow={shadow} />
      )}
    </Drawn>
  );
}

/** A MeshInstance3D's two material-override properties, already resolved against the scene. */
interface MeshOverrides {
  /** `material_override`: in front of every surface's material. */
  node?: MaterialSource;
  /** `surface_material_override/N`, keyed by Godot's original surface index. */
  perSurface: ReadonlyMap<number, MaterialSource>;
}

function resolveMeshOverrides(properties: MeshInstance3DProperties, scene: SceneResources): MeshOverrides {
  const perSurface = new Map<number, MaterialSource>();
  for (const [index, ref] of properties.surfaceMaterialOverrides ?? []) {
    const source = resolveMaterialSource(ref, scene);
    if (source) perSurface.set(index, source);
  }
  return {
    node: resolveMaterialSource(properties.materialOverride, scene),
    perSurface,
  };
}

/**
 * What Godot binds for one surface: the instance's surface override over the
 * mesh's material (`render_forward_clustered.cpp:4264`), then `material_override`
 * in front (`:4206`), else the default material (`:4221`), as
 * `MeshInstance3D::get_active_material` (`scene/3d/mesh_instance_3d.cpp:384`) restates.
 */
function effectiveMaterialSource(
  overrides: MeshOverrides,
  surfaceIndex: number,
  own: MaterialSource | undefined
): MaterialSource | undefined {
  return overrides.node ?? overrides.perSurface.get(surfaceIndex) ?? own;
}
