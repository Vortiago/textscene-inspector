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
import { findSubResource, useSceneResources } from '../../../r3f/SceneResourcesContext';
import { findExtResource, parseResourceReference } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { MeshGeometry } from './meshGeometry';
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
import { shadowCastingEffects, type ShadowCastingEffects } from '../../../r3f/shadowCasting';

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
    () => resolveMeshSubResource(properties.mesh, internalResources),
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

  // `cast_shadow` and each surface's billboard and shadow-pass membership reach three per
  // draw group, through hooks that read that group's material.
  const shadow = shadowCastingEffects(properties.castShadow);
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

  // No mesh, an external GLB or a missing SubResource. An external ArrayMesh is not
  // unresolved: it loads asynchronously below.
  if (!meshResource && !arrayMeshPath) {
    return (
      <MeshShell {...shellProps} overlay={null}>
        {UNRESOLVED_MESH}
      </MeshShell>
    );
  }

  if (arrayMeshPath) {
    if (arrayMeshResult.status === 'unavailable') {
      return (
        <MeshShell {...shellProps} overlay={null}>
          {UNRESOLVED_MESH}
        </MeshShell>
      );
    }
    // While it loads, the shell keeps the node's descendants mounted: they do not depend
    // on the `.tres`.
    if (!arrayMeshResult.value) return <MeshShell {...shellProps}>{null}</MeshShell>;

    return (
      <MeshShell {...shellProps}>
        <ArrayMeshSurfaces mesh={withFileMaterials(arrayMeshResult.value)} overrides={meshOverrides} />
      </MeshShell>
    );
  }

  // An unreadable scene ArrayMesh gets the placeholder: `buildPrimitiveMeshGeometry` has
  // no ArrayMesh case, so falling through would draw nothing.
  if (meshResource?.type === 'ArrayMesh') {
    return (
      <MeshShell {...shellProps}>
        {sceneArrayMesh ? (
          <ArrayMeshSurfaces mesh={sceneArrayMesh} overrides={meshOverrides} />
        ) : (
          UNRESOLVED_MESH
        )}
      </MeshShell>
    );
  }

  // No `attach`: `mesh.material` stays one Material for one surface. An array would make
  // three skip every draw group past the last entry, and a BoxGeometry declares six.
  return (
    <MeshShell {...shellProps}>
      <MeshGeometry resource={meshResource!} />
      <SurfaceMaterialSlot source={primarySource} triplanarMesh={meshResource} />
    </MeshShell>
  );
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
  // Dep-less, since a re-parse replaces the geometry and `[meshRef]` would keep the old
  // one. It cannot loop: the updater returns the same value when nothing moved.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- every commit is the dependency.
  useLayoutEffect(() => {
    const attached = meshRef.current?.geometry ?? null;
    setGeometry((previous) => (previous === attached ? previous : attached));
  });

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

function resolveMeshSubResource(
  meshRef: string | undefined,
  internalResources: readonly TscnInternalResource[]
): TscnInternalResource | undefined {
  if (!meshRef) return undefined;
  const parsed = parseResourceReference(meshRef);
  if (!parsed || parsed.type !== 'SubResource') return undefined;
  return findSubResource(internalResources, parsed.id);
}

/**
 * The `.tres` path of an `ExtResource("id")` ArrayMesh. Null for a SubResource,
 * a non-`.tres` ExtResource such as `.glb`, or an unknown id.
 */
function resolveExtArrayMeshPath(
  meshRef: string | undefined,
  externalResources: readonly TscnExternalResource[]
): string | null {
  if (!meshRef) return null;
  const parsed = parseResourceReference(meshRef);
  if (!parsed || parsed.type !== 'ExtResource') return null;
  const ext = findExtResource(externalResources, parsed.id);
  if (!ext?.path || !ext.path.endsWith('.tres')) return null;
  return ext.path;
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
  if (!meshRef) return undefined;
  const parsed = parseResourceReference(meshRef);
  if (!parsed || parsed.type !== 'SubResource') return undefined;
  const meshResource = findSubResource(internalResources, parsed.id);
  const material = meshResource?.data?.['material'];
  return typeof material === 'string' ? material : undefined;
}
