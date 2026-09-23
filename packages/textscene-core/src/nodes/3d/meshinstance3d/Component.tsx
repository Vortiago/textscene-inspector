/**
 * Renders a Godot MeshInstance3D as an R3F <mesh>: a primitive or ArrayMesh
 * geometry, or a magenta wireframe placeholder for a GLB or unresolvable mesh.
 * When the primary material's texture is missing, or its ViewportTexture albedo
 * is cyclic, the whole mesh takes a magenta placeholder material.
 */

import * as THREE from 'three';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import type { MeshInstance3DProperties } from './types';
import type {
  TscnExternalResource,
  TscnInternalResource,
} from '../../../parser/types';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { transformFromNode3DProperties } from '../../../r3f/nodeTransform';
import {
  findSubResource,
  useSceneResources,
} from '../../../r3f/SceneResourcesContext';
import { parseResourceReference } from '../../../resources/SubResourceResolver';
import { useResource } from '../../../resources/useResource';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { MeshGeometry } from './meshGeometry';
import { parseStandardMaterial3DScalars } from '../../../resources/materials/standardmaterial3d/scalars';
import { warn } from '../../../logger';
import { decodeSceneArrayMesh } from '../../../resources/meshes/arraymesh/decode';
import { buildArrayMeshGeometry } from '../../../resources/meshes/arraymesh/build';
import { StandardMaterialSlot } from '../../../r3f/materials/StandardMaterialSlot';
import { ExternalMaterialSlot } from '../../../r3f/materials/ExternalMaterialSlot';
import { resolveMaterialSource, type MaterialSource } from '../../../r3f/materials/materialSource';
import {
  SurfaceMaterialSlot,
  useMaterialTextures,
} from '../../../r3f/materials/SurfaceMaterialSlot';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import { wireGizmoProgram } from '../../../r3f/components/wireGizmoProgram';
import { useBillboard } from '../../../r3f/hooks/useBillboard';
import { visualLayersUserData } from '../../../r3f/visualLayers';
import { shadowCastingEffects } from '../../../r3f/shadowCasting';

/** Literal-only, so each key is constant and none of these ever remounts. */
const PLACEHOLDER_MATERIAL = materialProgramInputs({ props: { color: 'magenta' } });
const SHADOWS_ONLY_MATERIAL = materialProgramInputs({
  props: { attach: 'material', colorWrite: false, depthWrite: false },
});
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
  const sceneArrayMesh = useSceneArrayMeshGeometry(
    meshResource,
    internalResources,
    externalResources
  );

  // Surface 0's material, the only one a primitive mesh has. Every multi-surface mesh
  // is an ArrayMesh, which returns from its own branch below.
  const primarySource = useMemo(
    () => resolvePrimitiveMaterialSource(properties, internalResources, externalResources),
    [properties, internalResources, externalResources]
  );
  // Surface 0's material only when it lives in the scene, since this component resolves
  // its scalars and textures itself. A `.tres` material reads as absent here:
  // `<ExternalMaterialSlot>` builds it whole through the material pipeline.
  const materialSubResource = primarySource?.kind === 'scene' ? primarySource.resource : undefined;

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

  const materialScalars = useMemo(
    () =>
      materialSubResource
        ? parseStandardMaterial3DScalars(
            materialSubResource.data as Record<string, string>
          )
        : null,
    [materialSubResource]
  );

  // The per-surface texture chain, called as a hook rather than mounted as
  // `<SurfaceMaterialSlot>`: an unresolvable texture diverts the whole mesh below, and
  // mounting the component as well would bind and dispose every slot twice.
  const { maps, firstMissingPath, viewportCyclic } = useMaterialTextures(
    materialScalars,
    meshResource
  );

  // A ViewportTexture albedo whose target pass is cyclic never renders, so it takes the
  // missing-file placeholder rather than sampling the unwritten target.
  const materialUnresolved = firstMissingPath !== null || viewportCyclic;

  // A material's `billboard_mode` turns the whole mesh to face the camera, as Godot's
  // shader does. The hook no-ops for DISABLED or absent. The ref lands on whichever
  // `<mesh>` MeshShell renders.
  const meshRef = useRef<THREE.Mesh | null>(null);
  // Known gap: a billboarded mesh's children inherit its rotation here. In Godot the
  // billboard is a surface-only shader effect, so its children do not.
  useBillboard(meshRef, materialScalars?.billboardMode);

  // Mode 2 (DOUBLE_SIDED) reaches three's depth material per mesh. Mode 3 (SHADOWS_ONLY)
  // hides the mesh from the colour buffer while it keeps casting: MeshShell says why
  // that is not `visible = false`.
  const shadowFlags = shadowCastingEffects(properties.castShadow);
  // Godot excludes an additive, subtractive or multiply surface from the shadow pass.
  const blendTransparent =
    !!materialScalars && materialScalars.blending !== THREE.NormalBlending;
  const castShadow = shadowFlags.castShadow && !blendTransparent;
  const visible = properties.visible !== false;

  const shellProps = {
    name: node.name,
    meshRef,
    position,
    rotation,
    scale,
    visible,
    castShadow,
    shadowsOnly: shadowFlags.shadowsOnly,
    onBeforeShadow: shadowFlags.onBeforeShadow,
    godotLayers: properties.layers,
    subtree: children,
    overlay: overlaySource ? (
      <MaterialOverlayMesh meshRef={meshRef} source={overlaySource} />
    ) : null,
  };

  // No mesh, an external GLB or a missing SubResource. An external ArrayMesh is not
  // unresolved: it loads asynchronously below.
  if (!meshResource && !arrayMeshPath) {
    return <MeshShell {...shellProps} overlay={null}>{UNRESOLVED_MESH}</MeshShell>;
  }

  if (arrayMeshPath) {
    if (arrayMeshResult.status === 'unavailable') {
      return <MeshShell {...shellProps} overlay={null}>{UNRESOLVED_MESH}</MeshShell>;
    }
    // While it loads, the shell keeps the node's descendants mounted: they do not depend
    // on the `.tres`.
    if (!arrayMeshResult.value) return <MeshShell {...shellProps}>{null}</MeshShell>;

    return (
      <MeshShell {...shellProps}>
        <ArrayMeshSurfaces
          mesh={arrayMeshResult.value}
          overrides={meshOverrides}
        />
      </MeshShell>
    );
  }

  // An unreadable scene ArrayMesh gets the placeholder: `buildPrimitiveMeshGeometry` has
  // no ArrayMesh case, so falling through would draw nothing.
  if (meshResource?.type === 'ArrayMesh') {
    return (
      <MeshShell {...shellProps}>
        {sceneArrayMesh ? (
          <ArrayMeshSurfaces
            mesh={sceneArrayMesh.resource}
            sceneMaterials={sceneArrayMesh.sceneMaterials}
            overrides={meshOverrides}
          />
        ) : (
          UNRESOLVED_MESH
        )}
      </MeshShell>
    );
  }

  const geometryElement = <MeshGeometry resource={meshResource!} />;

  if (materialUnresolved) {
    return (
      <MeshShell {...shellProps} overlay={null}>
        {geometryElement}
        <meshStandardMaterial key={PLACEHOLDER_MATERIAL.key} {...PLACEHOLDER_MATERIAL.props} />
      </MeshShell>
    );
  }

  // No `attach`: `mesh.material` stays one Material for one surface. An array would make
  // three skip every draw group past the last entry, and a BoxGeometry declares six.
  return (
    <MeshShell {...shellProps}>
      {geometryElement}
      {primarySource?.kind === 'path' ? (
        <ExternalMaterialSlot path={primarySource.path} />
      ) : (
        <StandardMaterialSlot
          scalars={materialScalars}
          {...maps}
        />
      )}
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
}: {
  meshRef: RefObject<THREE.Mesh | null>;
  source: MaterialSource;
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
    >
      <SurfaceMaterialSlot source={source} />
    </mesh>
  );
}

interface MeshShellProps {
  name: string;
  /** Ref to the underlying THREE.Mesh, so `useBillboard` can turn it per frame. */
  meshRef: RefObject<THREE.Mesh | null>;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  visible: boolean;
  castShadow: boolean;
  /** `cast_shadow = SHADOWS_ONLY` (3): cast, but draw nothing. */
  shadowsOnly: boolean;
  /** `cast_shadow = DOUBLE_SIDED` (2) reaches the depth material through this. */
  onBeforeShadow: THREE.Object3D['onBeforeShadow'];
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
  castShadow,
  shadowsOnly,
  onBeforeShadow,
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
      castShadow={castShadow}
      // three fires this per mesh per light, after `getDepthMaterial` has set the side
      // (`WebGLShadowMap.js:477,535,549`): the only per-mesh reach into a depth material
      // three shares across objects.
      onBeforeShadow={onBeforeShadow}
      receiveShadow
      // Godot's `layers`, for `Decal.cull_mask`. Set on every branch, placeholders
      // included, so a decal's receiver test never depends on load order.
      userData={visualLayersUserData(godotLayers)}
    >
      {children}
      {/* SHADOWS_ONLY casts and keeps its descendants. `visible = false` would skip
          the shadow pass and the subtree in `WebGLShadowMap.renderObject`, and
          `material.visible` gates the depth material too. `getDepthMaterial` never
          copies `colorWrite`, so this material, attached last, hides only colour. */}
      {shadowsOnly && (
        <meshBasicMaterial key={SHADOWS_ONLY_MATERIAL.key} {...SHADOWS_ONLY_MATERIAL.props} />
      )}
      {/* Inside this mesh, so the overlay inherits the billboard transform. Skipped
          under SHADOWS_ONLY: the base's `colorWrite: false` material would not
          suppress a second mesh's colour. */}
      {!shadowsOnly && overlay}
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
 * An ArrayMesh's geometry plus one `<SurfaceMaterialSlot>` per draw group, so one
 * `useResource` per component serves any surface count. Godot sizes the override
 * array to the surface count (`scene/3d/mesh_instance_3d.cpp:68,407`), so the draw
 * groups set the slot count and an extra override is dropped.
 */
function ArrayMeshSurfaces({
  mesh,
  sceneMaterials,
  overrides,
}: {
  mesh: ArrayMeshResource;
  /** A scene mesh's own `[sub_resource]` materials, already resolved: no path names them. */
  sceneMaterials?: readonly (TscnInternalResource | undefined)[];
  overrides: MeshOverrides;
}) {
  const groupCount = Math.max(mesh.materialPaths.length, 1);
  const multiSurface = groupCount > 1;
  return (
    <>
      <primitive object={mesh.geometry} attach="geometry" />
      {Array.from({ length: groupCount }, (_unused, i) => {
        const attach = multiSurface ? `material-${i}` : 'material';
        const scene = sceneMaterials?.[i];
        const own: MaterialSource | undefined = scene
          ? { kind: 'scene', resource: scene }
          : mesh.materialPaths[i]
            ? { kind: 'path', path: mesh.materialPaths[i]! }
            : undefined;
        const source = effectiveMaterialSource(overrides, mesh.surfaceIndices[i] ?? i, own);
        return <SurfaceMaterialSlot key={`surf-${i}`} source={source} attach={attach} />;
      })}
    </>
  );
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
 * The geometry of an ArrayMesh the scene declares as its own `[sub_resource]`.
 * Null for any other mesh type or for unreadable surfaces, and the caller then
 * shows its placeholder. This hook disposes the geometry: r3f never disposes an
 * object handed to `<primitive>`.
 */
function useSceneArrayMeshGeometry(
  resource: TscnInternalResource | undefined,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): SceneArrayMesh | null {
  // Keyed on the surface bytes, not identity: every keystroke re-parses the scene into
  // fresh objects, and no processor cache stands in front of an inline mesh, so identity
  // deps would re-decode and re-upload it per character.
  const surfacesRaw = resource?.type === 'ArrayMesh' ? resource.data['_surfaces'] : undefined;
  const key = typeof surfacesRaw === 'string' ? surfacesRaw : null;

  const built = useMemo(() => {
    if (resource?.type !== 'ArrayMesh' || key === null) return null;
    try {
      const mesh = decodeSceneArrayMesh(resource, externalResources);
      if (mesh.surfaces.length === 0) return null;
      return {
        resource: {
          geometry: buildArrayMeshGeometry(mesh),
          materialPaths: mesh.surfaces.map((s) => s.materialPath ?? null),
          surfaceIndices: mesh.surfaces.map((s) => s.surfaceIndex),
        },
        // Resolved here, not in the decoder: only the renderer holds the scene's
        // resources, and no path reaches a scene's materials.
        sceneMaterials: mesh.surfaces.map((s) =>
          s.materialSubResourceId === undefined
            ? undefined
            : findSubResource(internalResources, s.materialSubResourceId)
        ),
      };
    } catch (error) {
      warn(
        `[MeshInstance3D] scene ArrayMesh "${resource.id}" could not be decoded: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
    // `key` stands in for `resource`/`externalResources`: same bytes, same mesh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => built?.resource.geometry.dispose(), [built]);
  return built;
}

interface SceneArrayMesh {
  resource: ArrayMeshResource;
  /** Per surface, the scene's own material sub-resource, when it names one. */
  sceneMaterials: readonly (TscnInternalResource | undefined)[];
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
  const ext = externalResources.find((r) => r.id === parsed.id);
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
