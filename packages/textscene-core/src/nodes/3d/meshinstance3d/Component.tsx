/**
 * Renders a Godot MeshInstance3D as an R3F <mesh>: the geometry `useMeshContent` reads,
 * or a magenta wireframe placeholder for a GLB, a mesh type no slice builds, or an
 * unresolvable mesh. A node with no `mesh` draws nothing.
 * Each surface draws through `<SurfaceMaterialSlot>`, which owns the magenta
 * missing-texture placeholder.
 */

import * as THREE from 'three';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { MeshInstance3DProperties } from './types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useSceneResources, type SceneResources } from '../../../r3f/SceneResourcesContext';
import { useResourceResolution } from '../../../resources/useSubOrExtResource';
import { useMeshContent, type SurfacedMesh } from '../../../r3f/meshes/meshContent';
import { resolveMaterialSource, type MaterialSource } from '../../../r3f/materials/materialSource';
import { SurfaceMaterialSlots } from '../../../r3f/materials/SurfaceMaterialSlots';
import { SurfaceMaterialSlot } from '../../../r3f/materials/SurfaceMaterialSlot';
import { wireGizmoProgram } from '../../../r3f/components/wireGizmoProgram';
import { visualLayersUserData } from '../../../r3f/visualLayers';
import type { ShadowCastingEffects } from '../../../r3f/shadowCasting';
import { useGeometryInstance } from '../../../r3f/visibilityRange/geometryInstance';
import { livePlacement, UNPLACED } from '../../../r3f/visibilityRange/placements';

/** Literal-only, so its key is constant and it never remounts. */
const UNRESOLVED_MESH_MATERIAL = wireGizmoProgram(0xff00ff);

export function MeshInstance3D({ node, children }: NodeComponentProps) {
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

  // The ref lands on whichever `<mesh>` MeshShell renders, for the overlay to share.
  const meshRef = useRef<THREE.Mesh | null>(null);

  // GeometryInstance3D's, so it reaches every surface this node draws, the overlay's too.
  // `cast_shadow`, the range cull and each surface's billboard and shadow-pass membership reach
  // three per draw group, through hooks that read that group's material.
  const placement = useMemo(() => livePlacement(meshRef, meshRef), []);
  // The placeholder box is not the mesh's, so the cull cannot measure the instance.
  const shadow = useGeometryInstance(content.kind === 'unresolved' ? UNPLACED : placement);

  const shellProps = {
    name: node.name,
    meshRef,
    position,
    rotation,
    scale,
    shadow,
    godotLayers: properties.layers,
    subtree: children,
    overlay: overlaySource ? (
      <MaterialOverlayMesh meshRef={meshRef} source={overlaySource} shadow={shadow} />
    ) : null,
  };

  switch (content.kind) {
    case 'unresolved':
      // No `mesh` is Godot's empty node, which draws nothing. Only a mesh this previewer cannot
      // build gets the placeholder.
      return (
        <MeshShell {...shellProps} overlay={null}>
          {properties.mesh === undefined ? null : UNRESOLVED_MESH}
        </MeshShell>
      );
    // While it loads, the shell keeps the node's descendants mounted: they do not depend on
    // the `.tres`. A mesh Godot builds no surface for draws nothing, its descendants still mount.
    case 'loading':
    case 'empty':
      return <MeshShell {...shellProps}>{null}</MeshShell>;
    case 'surfaced':
      return (
        <MeshShell {...shellProps}>
          <MeshSurfaces mesh={content.mesh} overrides={meshOverrides} />
        </MeshShell>
      );
  }
}

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
  source,
  shadow,
}: {
  meshRef: RefObject<THREE.Mesh | null>;
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
  return (
    <mesh
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
      <SurfaceMaterialSlot source={source} />
    </mesh>
  );
}

interface MeshShellProps {
  name: string;
  /** Ref to the underlying THREE.Mesh, whose geometry the overlay draws again. */
  meshRef: RefObject<THREE.Mesh | null>;
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
  position,
  rotation,
  scale,
  shadow,
  godotLayers,
  subtree,
  overlay,
  children,
}: MeshShellProps) {
  return (
    <mesh
      ref={meshRef}
      name={name}
      position={position}
      rotation={rotation}
      scale={scale}
      castShadow={shadow.castShadow}
      // three fires these per draw group, the shadow pair after `getDepthMaterial` has
      // set the side (`WebGLShadowMap.js:488,546,560`): the only per-surface reach into
      // a draw of an object whose materials and depth material three shares.
      onBeforeRender={shadow.onBeforeRender}
      onAfterRender={shadow.onAfterRender}
      onBeforeShadow={shadow.onBeforeShadow}
      onAfterShadow={shadow.onAfterShadow}
      receiveShadow
      // Godot's `layers`, for the decal and probe masks. Set on every branch, placeholders
      // included, so a decal's receiver test never depends on load order.
      userData={visualLayersUserData(godotLayers)}
    >
      {children}
      {/* Not `visible = false` for SHADOWS_ONLY: `WebGLShadowMap.renderObject` would skip
          the shadow pass and the subtree. The hooks skip each colour draw instead. */}
      {overlay}
      {subtree}
    </mesh>
  );
}

/**
 * What an unresolved mesh renders as: no mesh, a failed external `.tres`, or a
 * scene sub-resource whose surfaces could not be read.
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
function MeshSurfaces({ mesh, overrides }: { mesh: SurfacedMesh; overrides: MeshOverrides }) {
  const groupCount = Math.max(mesh.surfaceIndices.length, 1);
  const sources = Array.from({ length: groupCount }, (_unused, i) =>
    effectiveMaterialSource(overrides, mesh.surfaceIndices[i] ?? i, mesh.materials[i])
  );
  return (
    <>
      <primitive object={mesh.geometry} attach="geometry" />
      <SurfaceMaterialSlots sources={sources} triplanarMesh={mesh.primitive} />
    </>
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
