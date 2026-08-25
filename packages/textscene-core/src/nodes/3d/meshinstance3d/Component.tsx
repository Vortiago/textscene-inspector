/**
 * <MeshInstance3D> — renders a Godot MeshInstance3D as an R3F <mesh>.
 *
 * Geometry: resolved synchronously from the scene's internal resources
 * (BoxMesh, SphereMesh, PlaneMesh, CylinderMesh, CapsuleMesh, TorusMesh,
 * PrismMesh). GLB / unresolvable references render a magenta wireframe
 * placeholder.
 *
 * Material: scalars parse synchronously off the scene's internal resources;
 * every surface's textures resolve through `<SurfaceMaterialSlot>`, the shared
 * per-surface chain. This node keeps only what is per-MESH: when the PRIMARY
 * material's texture comes back missing (or its ViewportTexture albedo is
 * cyclic), the whole mesh switches to a magenta placeholder material.
 *
 * Material precedence, per surface, is Godot's:
 *   material_override > surface_material_override/N > the surface's own material >
 *   the renderer's default material
 * (`render_forward_clustered.cpp:4206,4264,4221`, restated by
 * `MeshInstance3D::get_active_material`, `scene/3d/mesh_instance_3d.cpp:384`).
 * Every branch resolves exactly that, and each rank accepts either arrival — a
 * `[sub_resource]` of the scene or an `ExtResource` naming a `.tres`, which the
 * engine cannot tell apart.
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

  // An ExtResource `mesh` pointing at a `.tres` is an external ArrayMesh:
  // resolve its path and decode it through the resource pipeline. (.glb
  // ExtResources fall through to the placeholder, as before.) The hook is
  // called unconditionally with `''` when the mesh isn't an external
  // ArrayMesh, matching the texture-slot pattern (rules of hooks).
  const arrayMeshPath = useMemo(
    () => resolveExtArrayMeshPath(properties.mesh, externalResources),
    [properties.mesh, externalResources]
  );
  const arrayMeshResult = useResource<ArrayMeshResource>(arrayMeshPath ?? '', 'ArrayMesh');

  // A `[sub_resource type="ArrayMesh"]` of the SCENE: baked surfaces inlined in
  // the `.tscn`, so there is no file to fetch and nothing for the resource
  // pipeline to do — it decodes synchronously from the parsed scene.
  const sceneArrayMesh = useSceneArrayMeshGeometry(
    meshResource,
    internalResources,
    externalResources
  );

  // Surface 0's, and a primitive mesh's only one — every multi-surface mesh
  // kind is an ArrayMesh, which returns from its own branch below.
  const primarySource = useMemo(
    () => resolvePrimitiveMaterialSource(properties, internalResources, externalResources),
    [properties, internalResources, externalResources]
  );
  // Surface 0's material WHEN IT LIVES IN THE SCENE: that is the one whose scalars
  // and texture references this component resolves itself. A slot holding a `.tres`
  // path has none of that here — the material pipeline builds it whole, behind
  // `<ExternalMaterialSlot>` — so it reads as "no sub-resource material", exactly
  // as an absent one does.
  const materialSubResource = primarySource?.kind === 'scene' ? primarySource.resource : undefined;

  // The same two override properties as an ArrayMesh sees them. A baked mesh's
  // surfaces are draw groups indexed by the mesh's OWN surface numbering, so they
  // cannot go through the per-slot collapse above — but Godot applies the
  // overrides to both kinds of mesh identically.
  const meshOverrides = useMemo(
    () => resolveMeshOverrides(properties, internalResources, externalResources),
    [properties, internalResources, externalResources]
  );

  // NOT one of the overrides above: `material_overlay` never competes for a
  // surface slot. It is resolved on its own because it is drawn on its own.
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

  // The material's textures, through the SAME per-surface chain every other
  // surface uses. Called here rather than mounted as `<SurfaceMaterialSlot>`
  // because the node needs the chain's OUTCOME: an unresolvable texture diverts
  // the whole MESH below, and mounting the component as well would bind — and
  // later dispose — every slot of this surface twice.
  const { maps, firstMissingPath, viewportCyclic } = useMaterialTextures(
    materialScalars,
    meshResource
  );

  // A ViewportTexture albedo whose target's pass is cyclic never renders — same
  // visible fact as a missing file, so it takes the same magenta placeholder
  // branch below rather than silently sampling the unwritten target.
  const materialUnresolved = firstMissingPath !== null || viewportCyclic;

  // A StandardMaterial3D carrying `billboard_mode` turns the whole mesh to
  // face the camera — the same per-material effect Godot's shader applies, and
  // the same enum `useBillboard` already implements for Label3D/Sprite3D. The
  // hook is called unconditionally (rules of hooks) with the primary material's
  // mode; it no-ops for the DISABLED/absent case, i.e. almost every mesh. The
  // ref lands on whichever branch's `<mesh>` MeshShell renders. NOTE: a
  // billboarded mesh's scene-tree children render inside the mesh and would
  // inherit its billboard rotation, which Godot (a surface-only shader effect)
  // does not do — no corpus scene billboards a mesh with children.
  const meshRef = useRef<THREE.Mesh | null>(null);
  useBillboard(meshRef, materialScalars?.billboardMode);

  // Mode 2 (DOUBLE_SIDED) reaches three's depth material per mesh; mode 3
  // (SHADOWS_ONLY) hides the mesh from the colour buffer while it keeps casting
  // — see MeshShell for why that is NOT `visible = false`.
  const shadowFlags = shadowCastingEffects(properties.castShadow);
  // A blend-mode-transparent material (additive / subtractive / multiply)
  // writes no shadow: Godot excludes those surfaces from the shadow pass, so an
  // additive glow sprite must not drop a solid silhouette on the ground.
  const blendTransparent =
    !!materialScalars && materialScalars.blending !== THREE.NormalBlending;
  const castShadow = shadowFlags.castShadow && !blendTransparent;
  const visible = properties.visible !== false;

  // Every render branch wraps its content in the same attribute shell.
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

  // Unresolved mesh (no mesh, external GLB, missing SubResource): magenta
  // wireframe placeholder. An external ArrayMesh (`arrayMeshPath`) is NOT
  // unresolved — it loads asynchronously below.
  if (!meshResource && !arrayMeshPath) {
    return <MeshShell {...shellProps} overlay={null}>{UNRESOLVED_MESH}</MeshShell>;
  }

  // External ArrayMesh: surface its load states. `unavailable` → the .tres
  // couldn't be loaded, show the magenta placeholder; `pending` → render
  // nothing until the geometry arrives (the node still lives in the tree view).
  if (arrayMeshPath) {
    if (arrayMeshResult.status === 'unavailable') {
      return <MeshShell {...shellProps} overlay={null}>{UNRESOLVED_MESH}</MeshShell>;
    }
    // Still loading: draw no geometry, but keep the shell so the node's own
    // descendants (which do not depend on the .tres) stay mounted meanwhile.
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

  // A scene's own `[sub_resource type="ArrayMesh"]` — same geometry and material
  // slots, the bytes just came from the `.tscn` rather than a `.tres`. Unreadable
  // gets the placeholder, not silence: `buildPrimitiveMeshGeometry` has no
  // ArrayMesh case, so falling through would draw nothing at all.
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

  // Primitive SubResource geometry (declarative <MeshGeometry>).
  const geometryElement = <MeshGeometry resource={meshResource!} />;

  // Missing texture: magenta placeholder material. The in-3D floating
  // label was redundant once the DOM `<MissingResourcesPanel>` lists
  // every missing path. `firstMissingPath` is still used for the
  // placeholder branch trigger, alongside a cyclic ViewportTexture albedo.
  if (materialUnresolved) {
    return (
      <MeshShell {...shellProps} overlay={null}>
        {geometryElement}
        <meshStandardMaterial key={PLACEHOLDER_MATERIAL.key} {...PLACEHOLDER_MATERIAL.props} />
      </MeshShell>
    );
  }

  // No `attach`: `mesh.material` stays a singular Material, which is what one
  // surface means. Handing three an ARRAY here would make it skip every draw
  // group past the last defined entry — a BoxGeometry declares six.
  return (
    <MeshShell {...shellProps}>
      {geometryElement}
      {primarySource?.kind === 'path' ? (
        <ExternalMaterialSlot path={primarySource.path} />
      ) : (
        <StandardMaterialSlot
          scalars={materialScalars}
          {...maps}
          meshType={meshResource?.type}
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

/** Opt this mesh out of picking entirely — three calls `raycast` and collects nothing. */
const NO_RAYCAST: THREE.Object3D['raycast'] = () => {};

/**
 * `material_overlay`'s own draw: the surface's geometry a second time, with the
 * overlay material.
 *
 * A separate mesh rather than an extra entry in the base mesh's material array,
 * because Godot's overlay covers EVERY surface — `_geometry_instance_add_surface`
 * runs per surface and adds it to each — while a material array is indexed by
 * surface. Handing three one material and a grouped geometry draws the whole
 * index range once, which is the same pixels.
 *
 * The geometry comes off the base mesh at commit time rather than being built
 * again: all four of this component's geometry branches attach it there, so
 * reading it back is what keeps this one component instead of four, and the two
 * meshes provably share a geometry rather than two equal ones. Re-read on every
 * commit because a re-parse replaces it.
 */
function MaterialOverlayMesh({
  meshRef,
  source,
}: {
  meshRef: RefObject<THREE.Mesh | null>;
  source: MaterialSource;
}) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  // Deliberately dep-less: `[meshRef]` would run this once, and the geometry it
  // read would then outlive the re-parse that replaced it — which is the case
  // this exists for. It cannot loop, because the updater returns the SAME value
  // when nothing moved and React bails out of the re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- every commit is the dependency.
  useLayoutEffect(() => {
    const attached = meshRef.current?.geometry ?? null;
    setGeometry((previous) => (previous === attached ? previous : attached));
  });

  if (!geometry) return null;
  return (
    <mesh
      geometry={geometry}
      // Explicit, because three's own tie-breaks are creation order — object id
      // in the transparent list, material id in the opaque one — and a re-parse
      // that remounts one material and not the other would invert them, drawing
      // the overlay UNDER the surface it covers. Godot has no such ambiguity:
      // the overlay is appended after the surface's own material chain.
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
  /** `layers` — the VisualInstance3D render mask a Decal's `cull_mask` filters on. */
  godotLayers: number | undefined;
  /** The dispatched scene-tree subtree parented under this MeshInstance3D. */
  subtree: ReactNode;
  /** `material_overlay`'s second draw of this same surface, if the node has one. */
  overlay: ReactNode;
  children: ReactNode;
}

/**
 * Shared attribute shell for every `<mesh>` branch in MeshInstance3D.
 * All five branches (placeholder, unavailable ArrayMesh, loading ArrayMesh,
 * missing-texture and fully-resolved) set the same props; this helper keeps
 * them in one place so a future prop rename or addition only changes one
 * definition.
 *
 * `children` is the geometry/material slot each branch fills; `subtree` is the
 * node's own scene-tree descendants, which render inside the mesh so they
 * inherit its transform (Godot draws children after, and relative to, the
 * node). Every branch — including the ones that draw a placeholder — must pass
 * it, or the descendants vanish with the mesh.
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
      // three fires this per mesh per light, after `getDepthMaterial` has set
      // the side (`WebGLShadowMap.js:477,535,549`) — the only per-mesh reach
      // into a depth material three shares across objects.
      onBeforeShadow={onBeforeShadow}
      receiveShadow
      // Godot's `layers`, carried for the consumers that filter on it — today
      // `Decal.cull_mask`. Set on every branch's mesh, including the placeholder
      // ones, so a decal's receiver test never depends on load order.
      userData={visualLayersUserData(godotLayers)}
    >
      {children}
      {/* SHADOWS_ONLY draws nothing but must still CAST, and its descendants
          must still render. `visible = false` gives neither: three's
          `WebGLShadowMap.renderObject` opens with
          `if (object.visible === false) return;`, which skips the shadow pass
          AND stops walking the subtree. Setting `material.visible = false` is
          no better — the same function gates the depth material on it. A
          material that writes neither colour nor depth is what separates the
          two passes: `getDepthMaterial` copies alphaMap/alphaTest/map and never
          `colorWrite`, so the shadow comes through untouched. Mounting after
          `children` makes this the material R3F attaches last. */}
      {shadowsOnly && (
        <meshBasicMaterial key={SHADOWS_ONLY_MATERIAL.key} {...SHADOWS_ONLY_MATERIAL.props} />
      )}
      {/* Inside this mesh, so the overlay inherits the transform `useBillboard`
          may be turning per frame rather than tracking it separately. Skipped
          under SHADOWS_ONLY, which draws no colour at all — the base's
          `colorWrite: false` material would not suppress a second mesh's. */}
      {!shadowsOnly && overlay}
      {subtree}
    </mesh>
  );
}

/**
 * What a mesh reference that resolves to nothing renders as. One value, because
 * three branches reach it: no mesh at all, an external `.tres` that failed, and a
 * scene sub-resource whose surfaces could not be read.
 */
const UNRESOLVED_MESH = (
  <>
    <boxGeometry args={[1, 1, 1]} />
    <meshBasicMaterial key={UNRESOLVED_MESH_MATERIAL.key} {...UNRESOLVED_MESH_MATERIAL.props} />
  </>
);

/**
 * A decoded ArrayMesh's geometry plus one material slot per draw group. Each
 * surface resolves its own material — scene sub-resource or `.tres`, textures
 * included — through its own `<SurfaceMaterialSlot>`, which keeps `useResource`
 * one-per-component (rules of hooks) for any surface count.
 *
 * Shared by both ArrayMesh sources — an external `.tres` and a scene's own
 * `[sub_resource]` — because where the bytes came from stops mattering here.
 *
 * The slot count comes from the DRAW GROUPS, never from the overrides: Godot
 * stores a per-surface override into an array sized to the mesh's surface count
 * (`scene/3d/mesh_instance_3d.cpp:68,407`), so an override naming a surface the
 * mesh does not have is dropped rather than growing the mesh.
 */
function ArrayMeshSurfaces({
  mesh,
  sceneMaterials,
  overrides,
}: {
  mesh: ArrayMeshResource;
  /**
   * For a mesh inlined in the scene: its own `[sub_resource]` materials, by id.
   * Those cannot be addressed by a resource path, so they arrive already resolved
   * rather than through the pipeline.
   */
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
  /** `surface_material_override/N`, keyed by Godot's ORIGINAL surface index. */
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
 * What Godot binds for one surface. `_geometry_instance_update` picks the
 * instance's own surface material over the mesh's, per surface
 * (`render_forward_clustered.cpp:4264`), and
 * `_geometry_instance_add_surface` then puts `material_override` in front of
 * whichever won, on every surface (`:4206`). Nothing left means the renderer's
 * default material (`:4221`), which is what an empty slot renders.
 */
function effectiveMaterialSource(
  overrides: MeshOverrides,
  surfaceIndex: number,
  own: MaterialSource | undefined
): MaterialSource | undefined {
  return overrides.node ?? overrides.perSurface.get(surfaceIndex) ?? own;
}

/**
 * Build the geometry for an ArrayMesh the SCENE declares as its own
 * `[sub_resource]`. Null for any other mesh type, and null when the surfaces
 * cannot be read — the caller shows its placeholder rather than nothing, because
 * an invisible node with no diagnostic is how this case went unnoticed.
 *
 * The geometry's lifetime is owned here: r3f disposes geometry it created from a
 * declarative element, but not an object handed to `<primitive>`.
 */
function useSceneArrayMeshGeometry(
  resource: TscnInternalResource | undefined,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): SceneArrayMesh | null {
  // Keyed on the surface BYTES, not on object identity. Every keystroke in the
  // source pane re-parses the scene and hands down fresh arrays and a fresh
  // resource object, so identity deps would re-decode and re-upload the whole
  // inline mesh on the render thread per character — and unlike the `.tres` path
  // there is no processor cache to absorb it.
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
        // Resolved here rather than in the decoder: only the renderer holds the
        // scene's resources, and a scene's materials are reachable by no path.
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
 * Resolve an `ExtResource("id")` `mesh` reference to the `.tres` path of an
 * external ArrayMesh. Returns null for SubResource refs (handled inline),
 * non-`.tres` ExtResources (e.g. `.glb`, handled by the placeholder), or
 * unknown ids.
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
 * Resolve the material(s) the mesh should render with. Returns an array
 * indexed by surface — element 0 always corresponds to surface 0.
 * Single-surface meshes return a length-1 array; multi-surface meshes
 * return a length-N array with `undefined` for unpopulated slots (the
 * caller's SecondarySurfaceMaterial renders a default placeholder).
 *
 * A slot resolves to a `MaterialSource`, not to a sub-resource, because a
 * material reference is as often an `ExtResource` naming a `.tres` as it is a
 * `[sub_resource]` of the scene — and the engine cannot tell the two apart.
 * `MeshInstance3D::set_surface_override_material`
 * (`scene/3d/mesh_instance_3d.cpp:366`) takes a `Ref<Material>` and hands the
 * server nothing but `->get_rid()`; `set_material_override` on GeometryInstance3D
 * does the same. Where the resource was loaded from is not represented past that
 * call, so a primitive mesh has to accept both arrivals exactly as the baked
 * ArrayMesh path below already does.
 *
 * Each slot collapses the same chain the renderer does,
 *   material_override > surface_material_override[N] > mesh-own,
 * per `render_forward_clustered.cpp:4206` (`material_override` in front, applied
 * inside the per-surface add) over `:4264` (the instance's per-surface override
 * ahead of the mesh's own). Only a node setting the top two together can tell
 * that order from its inverse. The mesh's own material is surface 0's alone —
 * a primitive mesh has exactly one surface to carry it.
 */
function resolvePrimitiveMaterialSource(
  properties: MeshInstance3DProperties,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): MaterialSource | undefined {
  // Surface 0 alone. `MeshInstance3D::_set` (`scene/3d/mesh_instance_3d.cpp:65-73`)
  // refuses any `surface_material_override/N` whose index is past
  // `surface_override_materials.size()`, and `_mesh_changed` (`:407`) sizes that
  // array to `mesh->get_surface_count()` — 1 for every PrimitiveMesh. So a
  // higher-numbered override is dropped rather than adding a surface.
  //
  // `material_override` first: it is applied inside
  // `_geometry_instance_add_surface`, which runs per surface, rather than as a
  // whole-mesh replacement. Then the per-surface override, then the mesh's own.
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


export { THREE };
