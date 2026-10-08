/**
 * Renders a Godot MeshInstance3D as an R3F <mesh>: a primitive or ArrayMesh
 * geometry, or a magenta wireframe placeholder for a GLB or unresolvable mesh.
 * Each surface draws through `<SurfaceMaterialSlot>`, which owns the magenta
 * missing-texture placeholder.
 */

import * as THREE from 'three';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import type { MeshInstance3DProperties } from './types';
import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useResource, type ResourceResult } from '../../../resources/useResource';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { MeshGeometry } from './meshGeometry';
import { resolveExtArrayMeshPath } from './meshResolution';
import { resolveSubResourceRef } from '../../../resources/SubResourceResolver';
import { warn } from '../../../logger';
import { decodeSceneArrayMesh } from '../../../resources/meshes/arraymesh/decode';
import { buildArrayMeshGeometry } from '../../../resources/meshes/arraymesh/build';
import {
  fileMaterialSources,
  resolveMaterialSource,
  type MaterialSource,
} from '../../../r3f/materials/materialSource';
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
  const { internalResources, externalResources } = useSceneResources();

  const { position, rotation, scale } = useMemo(
    () => transformFromNode3DProperties(properties),
    [properties]
  );

  const meshResource = useMemo(
    () => resolveSubResourceRef(properties.mesh, internalResources),
    [properties.mesh, internalResources]
  );

  // An ExtResource `.tres` mesh is an external ArrayMesh, decoded through the resource
  // pipeline. A `.glb` falls through to the placeholder. The hook runs with `''` for any
  // other mesh, since the rules of hooks forbid a conditional call.
  const arrayMeshPath = useMemo(
    () => resolveExtArrayMeshPath(properties.mesh, externalResources),
    [properties.mesh, externalResources]
  );
  const arrayMeshResult = useResource<ArrayMeshResource>(arrayMeshPath ?? '', 'arraymesh');

  // A scene's own `[sub_resource type="ArrayMesh"]` has its surfaces inlined in the
  // `.tscn`, so it decodes synchronously, with no file to fetch.
  const sceneArrayMesh = useSceneArrayMesh(meshResource, internalResources, externalResources);

  // Surface 0's material, the only one a primitive mesh has. Every multi-surface mesh
  // is an ArrayMesh, which returns from its own branch below.
  const primarySource = useMemo(
    () => resolvePrimitiveMaterialSource(properties, internalResources, externalResources),
    [properties, internalResources, externalResources]
  );

  // The same two overrides for an ArrayMesh. Its surfaces are draw groups indexed by the
  // mesh's own surface numbering, so they cannot use the per-slot collapse above, but
  // Godot applies the overrides to both kinds of mesh identically.
  const meshOverrides = useMemo(
    () => resolveMeshOverrides(properties, internalResources, externalResources),
    [properties, internalResources, externalResources]
  );

  // `material_overlay` never competes for a surface slot, so it resolves apart from the
  // overrides: it is drawn on its own.
  const overlaySource = useMemo(
    () => resolveMaterialSource(properties.materialOverlay, internalResources, externalResources),
    [properties.materialOverlay, internalResources, externalResources]
  );

  // The ref lands on whichever `<mesh>` MeshShell renders, for the overlay to share.
  const meshRef = useRef<THREE.Mesh | null>(null);

  // GeometryInstance3D's, so it reaches every surface this node draws, the overlay's too.
  // `cast_shadow`, the range cull and each surface's billboard and shadow-pass membership reach
  // three per draw group, through hooks that read that group's material.
  const placement = useMemo(() => livePlacement(meshRef, meshRef), []);
  const content = meshContent(meshResource, arrayMeshPath, arrayMeshResult, sceneArrayMesh);
  // The placeholder box is not the mesh's, so the cull cannot measure the instance.
  const shadow = useGeometryInstance(content.kind === 'unresolved' ? UNPLACED : placement);
  const visible = properties.visible !== false;

  const shellProps = {
    name: node.name,
    meshRef,
    position,
    rotation,
    scale,
    visible,
    shadow,
    godotLayers: properties.layers,
    subtree: children,
    overlay: overlaySource ? (
      <MaterialOverlayMesh meshRef={meshRef} source={overlaySource} shadow={shadow} />
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
    // the `.tres`.
    case 'loading':
      return <MeshShell {...shellProps}>{null}</MeshShell>;
    case 'arrayMesh':
      return (
        <MeshShell {...shellProps}>
          <ArrayMeshSurfaces mesh={content.mesh} overrides={meshOverrides} />
        </MeshShell>
      );
    // No `attach`: `mesh.material` stays one Material for one surface. An array would make
    // three skip every draw group past the last entry, and a BoxGeometry declares six.
    case 'primitive':
      return (
        <MeshShell {...shellProps}>
          <MeshGeometry resource={content.resource} />
          <SurfaceMaterialSlot source={primarySource} triplanarMesh={content.resource} />
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

/** What a MeshInstance3D draws. */
type MeshContent =
  | { kind: 'unresolved' }
  | { kind: 'loading' }
  | { kind: 'arrayMesh'; mesh: SurfacedMesh }
  | { kind: 'primitive'; resource: TscnInternalResource };

const UNRESOLVED: MeshContent = { kind: 'unresolved' };
const LOADING: MeshContent = { kind: 'loading' };

/**
 * The placeholder stands for no mesh, an external GLB, a missing SubResource, an external
 * ArrayMesh that cannot load, and a scene ArrayMesh that cannot be read. `buildPrimitiveMeshGeometry`
 * has no ArrayMesh case, so an unreadable one would otherwise draw nothing.
 */
function meshContent(
  meshResource: TscnInternalResource | undefined,
  arrayMeshPath: string | null,
  arrayMeshResult: ResourceResult<ArrayMeshResource>,
  sceneArrayMesh: SurfacedMesh | null
): MeshContent {
  if (arrayMeshPath) {
    if (arrayMeshResult.status === 'unavailable') return UNRESOLVED;
    return arrayMeshResult.value
      ? { kind: 'arrayMesh', mesh: withFileMaterials(arrayMeshResult.value) }
      : LOADING;
  }
  if (!meshResource) return UNRESOLVED;
  if (meshResource.type !== 'ArrayMesh') return { kind: 'primitive', resource: meshResource };
  return sceneArrayMesh ? { kind: 'arrayMesh', mesh: sceneArrayMesh } : UNRESOLVED;
}

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
  visible: boolean;
  /** `cast_shadow`, with the per-surface draw hooks: billboard, shadow pass, SHADOWS_ONLY. */
  shadow: ShadowCastingEffects;
  /** `layers`: the VisualInstance3D render mask a Decal's `cull_mask` filters on. */
  godotLayers: number | undefined;
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
  visible,
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
      visible={visible}
      castShadow={shadow.castShadow}
      // three fires these per draw group, the shadow pair after `getDepthMaterial` has
      // set the side (`WebGLShadowMap.js:488,546,560`): the only per-surface reach into
      // a draw of an object whose materials and depth material three shares.
      onBeforeRender={shadow.onBeforeRender}
      onAfterRender={shadow.onAfterRender}
      onBeforeShadow={shadow.onBeforeShadow}
      onAfterShadow={shadow.onAfterShadow}
      receiveShadow
      // Godot's `layers`, for `Decal.cull_mask`. Set on every branch, placeholders
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
 * An ArrayMesh's geometry plus a `<SurfaceMaterialSlots>` over its draw groups, so one
 * `useResource` per component serves any surface count. Godot sizes the override
 * array to the surface count (`scene/3d/mesh_instance_3d.cpp:68,407`), so the draw
 * groups set the slot count and an extra override is dropped.
 */
function ArrayMeshSurfaces({ mesh, overrides }: { mesh: SurfacedMesh; overrides: MeshOverrides }) {
  const groupCount = Math.max(mesh.surfaceIndices.length, 1);
  const sources = Array.from({ length: groupCount }, (_unused, i) =>
    effectiveMaterialSource(overrides, mesh.surfaceIndices[i] ?? i, mesh.materials[i])
  );
  return (
    <>
      <primitive object={mesh.geometry} attach="geometry" />
      <SurfaceMaterialSlots sources={sources} />
    </>
  );
}

/** An ArrayMesh's draw groups and each one's own material, whichever file holds it. */
interface SurfacedMesh {
  geometry: THREE.BufferGeometry;
  /** Per draw group, Godot's surface index, which `surface_material_override/N` names. */
  surfaceIndices: readonly number[];
  /** Per draw group, the material the surface names, when it names one. */
  materials: readonly (MaterialSource | undefined)[];
}

/** An external ArrayMesh's surfaces, each material a file the loader fetches. */
function withFileMaterials(mesh: ArrayMeshResource): SurfacedMesh {
  return {
    geometry: mesh.geometry,
    surfaceIndices: mesh.surfaceIndices,
    materials: fileMaterialSources(mesh.materialPaths),
  };
}

/** A MeshInstance3D's two material-override properties, already resolved. */
interface MeshOverrides {
  /** `material_override`: in front of every surface's material. */
  node?: MaterialSource;
  /** `surface_material_override/N`, keyed by Godot's original surface index. */
  perSurface: ReadonlyMap<number, MaterialSource>;
}

function resolveMeshOverrides(
  properties: MeshInstance3DProperties,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): MeshOverrides {
  const perSurface = new Map<number, MaterialSource>();
  for (const [index, ref] of properties.surfaceMaterialOverrides ?? []) {
    const source = resolveMaterialSource(ref, internalResources, externalResources);
    if (source) perSurface.set(index, source);
  }
  return {
    node: resolveMaterialSource(properties.materialOverride, internalResources, externalResources),
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

/**
 * An ArrayMesh the scene declares as its own `[sub_resource]`, with each surface's
 * material resolved against the scene's resources. Null for any other mesh type
 * or for unreadable surfaces, and the caller then shows its placeholder.
 */
function useSceneArrayMesh(
  resource: TscnInternalResource | undefined,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): SurfacedMesh | null {
  const decoded = useSceneArrayMeshGeometry(resource);
  // Apart from the decode: an edit to a material's body or to an `ext_resource`
  // path changes the resources and leaves the surface bytes alone.
  return useMemo(
    () =>
      decoded && {
        geometry: decoded.geometry,
        surfaceIndices: decoded.surfaceIndices,
        materials: decoded.materialRefs.map((ref) =>
          resolveMaterialSource(ref, internalResources, externalResources)
        ),
      },
    [decoded, internalResources, externalResources]
  );
}

/**
 * The decoded geometry of a scene ArrayMesh and each surface's raw material
 * reference. This hook disposes the geometry: r3f never disposes an object
 * handed to `<primitive>`.
 */
function useSceneArrayMeshGeometry(resource: TscnInternalResource | undefined): DecodedSceneArrayMesh | null {
  // Keyed on the surface bytes, not identity: every keystroke re-parses the scene into
  // fresh objects, and no processor cache stands in front of an inline mesh, so identity
  // deps would re-decode and re-upload it per character.
  const surfacesRaw = resource?.type === 'ArrayMesh' ? resource.data['_surfaces'] : undefined;
  const key = typeof surfacesRaw === 'string' ? surfacesRaw : null;

  const decoded = useMemo(() => {
    if (resource?.type !== 'ArrayMesh' || key === null) return null;
    try {
      const mesh = decodeSceneArrayMesh(resource);
      if (mesh.surfaces.length === 0) return null;
      return {
        geometry: buildArrayMeshGeometry(mesh),
        surfaceIndices: mesh.surfaces.map((s) => s.surfaceIndex),
        materialRefs: mesh.surfaces.map((s) => s.materialRef),
      };
    } catch (error) {
      warn(
        `[MeshInstance3D] scene ArrayMesh "${resource.id}" could not be decoded: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` IS the content of `resource`.
  }, [key]);

  useEffect(() => () => decoded?.geometry.dispose(), [decoded]);
  return decoded;
}

interface DecodedSceneArrayMesh extends Omit<SurfacedMesh, 'materials'> {
  /** Per surface, its raw `"material"` reference, when it has one. */
  materialRefs: readonly (string | undefined)[];
}

/**
 * The material of a primitive mesh's one surface, as a `MaterialSource`: the
 * engine hands the server only `->get_rid()`
 * (`scene/3d/mesh_instance_3d.cpp:366`), so a `.tres` and a `[sub_resource]`
 * are equal arrivals.
 */
function resolvePrimitiveMaterialSource(
  properties: MeshInstance3DProperties,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): MaterialSource | undefined {
  // Surface 0 alone: `_set` (`scene/3d/mesh_instance_3d.cpp:65-73`) refuses an override
  // index past the array that `_mesh_changed` (`:407`) sizes to the surface count, 1 for
  // every PrimitiveMesh. `material_override` comes first, as `_geometry_instance_add_surface`
  // applies it per surface (`render_forward_clustered.cpp:4206` over `:4264`).
  const ref =
    properties.materialOverride ??
    properties.surfaceMaterialOverrides?.get(0) ??
    findMeshOwnMaterial(properties.mesh, internalResources);
  return resolveMaterialSource(ref, internalResources, externalResources);
}

function findMeshOwnMaterial(
  meshRef: string | undefined,
  internalResources: readonly TscnInternalResource[]
): string | undefined {
  const material = resolveSubResourceRef(meshRef, internalResources)?.data['material'];
  return typeof material === 'string' ? material : undefined;
}
