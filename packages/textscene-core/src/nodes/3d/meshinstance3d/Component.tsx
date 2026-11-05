/**
 * Renders a Godot MeshInstance3D as an R3F <mesh>: the geometry `useMeshContent` reads,
 * or a magenta wireframe placeholder for a GLB, a mesh type no slice builds, or an
 * unresolvable mesh. A node with no `mesh` draws nothing.
 * Each surface draws through `<SurfaceMaterialSlot>`, which owns the magenta
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
import { geometryPrimitive, type SurfacePrimitive } from '../../../resources/meshes/godotSurface';
import { resolveMaterialSource, type MaterialSource } from '../../../r3f/materials/materialSource';
import { SurfaceMaterialSlots } from '../../../r3f/materials/SurfaceMaterialSlots';
import { SurfaceMaterialSlot } from '../../../r3f/materials/SurfaceMaterialSlot';
import { overlayDrawProps } from '../../../r3f/materials/materialOverlay';
import {
  NOTHING_DRAWN,
  NextPassChain,
  NextPassLink,
  drawnElementOf,
  useDrawnGeometry,
} from '../../../r3f/materials/nextPass';
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
  const primitive: SurfacePrimitive =
    content.kind === 'surfaced' ? geometryPrimitive(content.mesh.parts[0].geometry) : 'triangles';
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
    primitive,
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
          <MeshSurfaces
            part={parts[0]}
            overrides={meshOverrides}
            meshRef={meshRef}
            skeleton={skeleton}
            godotLayers={properties.layers}
            overlaySource={overlaySource}
            shadow={shadow}
          />
          {parts.slice(1).map((part, i) => (
            <FollowingPart
              key={i}
              part={part}
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
 * `material_overlay`'s draw: the base mesh's geometry a second time, with the
 * overlay material. A separate mesh, not a material array entry: Godot's
 * overlay covers every surface (`_geometry_instance_add_surface` runs per
 * surface), and one material over a grouped geometry draws the same pixels.
 * A valid overlay's own `next_pass` chain mounts after its draw
 * (`render_forward_clustered.cpp:4230-4239`), its links sharing the base draw's
 * geometry.
 */
function MaterialOverlayMesh({
  meshRef,
  primitive,
  skeleton,
  godotLayers,
  source,
  shadow,
  renderOrder,
}: {
  meshRef: RefObject<DrawnMesh | null>;
  /** What the base draws, so the overlay draws it too. */
  primitive: SurfacePrimitive;
  /** The base is skinned, so the overlay is skinned by the same skeleton. */
  skeleton?: THREE.Skeleton | null;
  /** The node's `layers`, which an overlay chain draw carries for the decals and probes. */
  godotLayers: number;
  source: MaterialSource;
  /**
   * The base mesh's hooks. The overlay casts nothing of its own, so only the colour pair
   * mounts: its own material decides its billboard, and SHADOWS_ONLY skips its draw too.
   */
  shadow: ShadowCastingEffects;
  /** The explicit order one past the part's surface chains (`nextPassRenderOrder`). */
  renderOrder: number;
}) {
  // Read back off the base mesh rather than built again, so all four geometry branches
  // share one component and the two meshes share one geometry.
  const geometry = useDrawnGeometry(meshRef);
  if (!geometry) return null;
  const { Drawn, skin } = drawnElementOf(primitive, skeleton);
  return (
    <>
      <Drawn
        {...skin}
        geometry={geometry}
        {...overlayDrawProps(shadow)}
        renderOrder={renderOrder}
        receiveShadow
      >
        <SurfaceMaterialSlot source={source} points={primitive === 'points' ? 'mesh' : undefined} />
      </Drawn>
      <NextPassLink
        source={source}
        ordinal={renderOrder}
        drawsSelf={false}
        // The overlay drew at this order; its own key lands in the set on recursion.
        visited={NOTHING_DRAWN}
        geometry={geometry}
        attach="material"
        surfaceCount={1}
        primitive={primitive}
        skeleton={skeleton}
        godotLayers={godotLayers}
        shadow={shadow}
      />
    </>
  );
}

interface MeshShellProps {
  name: string;
  /** Ref to the underlying THREE.Mesh or THREE.Points, whose geometry the overlay draws again. */
  meshRef: RefObject<DrawnMesh | null>;
  /** What the mesh's first part draws, which the shell mounts as `<mesh>`, `<points>` or `<lineSegments>`. */
  primitive: SurfacePrimitive;
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
  primitive,
  skeleton,
  transform,
  shadow,
  godotLayers,
  subtree,
  children,
}: MeshShellProps) {
  const { Drawn, skin } = drawnElementOf(primitive, skeleton);
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
 * A mesh's geometry plus a `<SurfaceMaterialSlots>` over its draw groups, so one hook per
 * component serves any surface count. Godot sizes the override array to the surface count
 * (`scene/3d/mesh_instance_3d.cpp:68,407`), so the draw groups set the slot count and an extra
 * override is dropped: a PrimitiveMesh takes only surface 0's. Each group's starting material
 * carries its own `next_pass` chain through `<NextPassChain>`, and the part's overlay mounts
 * through the chain, one past the surface chains.
 */
function MeshSurfaces({
  part,
  overrides,
  meshRef,
  skeleton,
  godotLayers,
  overlaySource,
  shadow,
}: {
  part: SurfacedPart;
  overrides: MeshOverrides;
  /** The base draw, whose geometry every chain draw shares. */
  meshRef: RefObject<DrawnMesh | null>;
  /** The skeleton that skins the shell's surfaces, or null for an unskinned draw. */
  skeleton?: THREE.Skeleton | null;
  /** The node's `layers`, which the chain draws carry for the decals and probes. */
  godotLayers: number;
  overlaySource: MaterialSource | undefined;
  shadow: ShadowCastingEffects;
}) {
  const groupCount = Math.max(part.surfaceIndices.length, 1);
  const sources = Array.from({ length: groupCount }, (_unused, i) =>
    effectiveMaterialSource(overrides, part.surfaceIndices[i] ?? i, part.materials[i])
  );
  const primitive = geometryPrimitive(part.geometry);
  return (
    <>
      <primitive object={part.geometry} attach="geometry" />
      <SurfaceMaterialSlots sources={sources} points={primitive === 'points' ? 'mesh' : undefined} />
      <NextPassChain
        meshRef={meshRef}
        sources={sources}
        primitive={primitive}
        skeleton={skeleton}
        godotLayers={godotLayers}
        shadow={shadow}
        overlay={
          overlaySource
            ? (renderOrder) => (
                <MaterialOverlayMesh
                  meshRef={meshRef}
                  primitive={primitive}
                  skeleton={skeleton}
                  godotLayers={godotLayers}
                  source={overlaySource}
                  shadow={shadow}
                  renderOrder={renderOrder}
                />
              )
            : undefined
        }
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
  overlaySource,
  shadow,
  godotLayers,
}: {
  part: SurfacedPart;
  overrides: MeshOverrides;
  overlaySource: MaterialSource | undefined;
  shadow: ShadowCastingEffects;
  godotLayers: number;
}) {
  const ref = useRef<DrawnMesh | null>(null);
  const Drawn = drawnTag(geometryPrimitive(part.geometry));
  return (
    <Drawn ref={ref} {...drawHookProps(shadow)} userData={visualLayersUserData(godotLayers)}>
      <MeshSurfaces
        part={part}
        overrides={overrides}
        meshRef={ref}
        godotLayers={godotLayers}
        overlaySource={overlaySource}
        shadow={shadow}
      />
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
