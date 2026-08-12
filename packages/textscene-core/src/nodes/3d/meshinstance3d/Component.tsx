/**
 * <MeshInstance3D> — renders a Godot MeshInstance3D as an R3F <mesh>.
 *
 * Geometry: resolved synchronously from the scene's internal resources
 * (BoxMesh, SphereMesh, PlaneMesh, CylinderMesh, CapsuleMesh, TorusMesh,
 * PrismMesh). GLB / unresolvable references render a magenta wireframe
 * placeholder.
 *
 * Material: synchronously parses StandardMaterial3D scalar properties
 * (albedo color, metallic, roughness, opacity) from the scene's internal
 * resources. External textures route through `useResource` and the host
 * file provider. When ANY referenced texture comes back missing, the
 * mesh switches to a magenta placeholder material with a drei `<Text>`
 * label naming the missing path.
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
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react';
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
import { resolveProceduralTexture } from '../../../resources/textures/resolveProceduralTexture';
import { useViewportTextureSlot } from '../../../resources/textures/viewporttexture/useViewportTextureSlot';
import { useProceduralTexturePins } from '../../../resources/useProceduralTexture';
import { useResource } from '../../../resources/useResource';
import type { ArrayMeshResource } from '../../../resources/processors/createArrayMeshProcessor';
import { MeshGeometry } from './meshGeometry';
import { resolveEmission } from '../../../resources/materials/standardmaterial3d/emission';
import { parseStandardMaterial3DScalars } from '../../../resources/materials/standardmaterial3d/scalars';
import { materialBlendProps } from '../../../resources/materials/standardmaterial3d/build';
import { warn } from '../../../logger';
import { decodeSceneArrayMesh } from '../../../resources/meshes/arraymesh/decode';
import { buildArrayMeshGeometry } from '../../../resources/meshes/arraymesh/build';
import { StandardMaterialSlot } from '../../../r3f/materials/StandardMaterialSlot';
import { ExternalMaterialSlot } from '../../../r3f/materials/ExternalMaterialSlot';
import { resolveMaterialSource, type MaterialSource } from '../../../r3f/materials/materialSource';
import {
  GODOT_DEFAULT_ALBEDO,
  GODOT_DEFAULT_METALLIC,
  GODOT_DEFAULT_ROUGHNESS,
} from '../../../r3f/materials/godotDefaultMaterial';
import { useBillboard } from '../../../r3f/hooks/useBillboard';
import { visualLayersUserData } from '../../../r3f/visualLayers';
import type { MaterialTextureState } from '../../../resources/textures/applyTextureState';
import {
  bindSlotTexture,
  releaseBoundTexture,
} from '../../../resources/materials/standardmaterial3d/textureBinding';
import {
  TEXTURE_SLOTS,
  type TextureSlot,
} from '../../../resources/materials/standardmaterial3d/types';
import { GODOT_TEXTURE_FILTER_DEFAULT } from '../../../resources/textures/godotTextureFilter';
import { repackAnisotropyFlowmap } from '../../../resources/textures/repackFlowmap';
import { triplanarPlaneScale } from './triplanarScale';

// The slot list is the decode's own (`TEXTURE_SLOTS`), not a second copy: the
// `useResource` fan-out below calls one hook per entry, so a list that drifted
// from the decode's would silently stop fetching a slot the material declares.
// Its ORDER is load-bearing here — hooks must be called unconditionally in a
// stable order.
const TEXTURE_PROPERTIES = TEXTURE_SLOTS;

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

  // One entry per surface: when several `surface_material_override/N` slots are
  // populated (a GLB or multi-surface mesh) each surface gets its own material
  // slot. Single-surface meshes return a length-1 array.
  const materialSources = useMemo(
    () => resolveMaterialSources(properties, internalResources, externalResources),
    [properties, internalResources, externalResources]
  );
  // Surface 0's material WHEN IT LIVES IN THE SCENE: that is the one whose scalars
  // and texture references this component resolves itself. A slot holding a `.tres`
  // path has none of that here — the material pipeline builds it whole, behind
  // `<ExternalMaterialSlot>` — so it reads as "no sub-resource material", exactly
  // as an absent one does.
  const primarySource = materialSources[0];
  const materialSubResource = primarySource?.kind === 'scene' ? primarySource.resource : undefined;

  // The same two override properties as an ArrayMesh sees them. A baked mesh's
  // surfaces are draw groups indexed by the mesh's OWN surface numbering, so they
  // cannot go through the per-slot collapse above — but Godot applies the
  // overrides to both kinds of mesh identically.
  const meshOverrides = useMemo(
    () => resolveMeshOverrides(properties, internalResources, externalResources),
    [properties, internalResources, externalResources]
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

  // Collect texture-path references off the SubResource material and
  // ask the resource loader for each one. The path is the resolved
  // `ExtResource("id").path`; if the metadata doesn't include it (rare),
  // we skip the slot.
  const textureRequests = useMemo(
    () => collectTextureRequests(materialSubResource, externalResources),
    [materialSubResource, externalResources]
  );

  // Drive `useResource` for every requested slot. Hooks must be called
  // unconditionally, in stable order — `TEXTURE_PROPERTIES` is the
  // canonical ordering so even an empty request still calls each hook
  // with an `''` path placeholder, which the hook treats as a no-op
  // (returns `pending` and emits nothing because nothing subscribes
  // to an empty path).
  const albedoStatus = useResource<THREE.Texture>(
    textureRequests.albedo_texture ?? '',
    'Texture2D'
  );
  const normalStatus = useResource<THREE.Texture>(
    textureRequests.normal_texture ?? '',
    'Texture2D'
  );
  const roughnessStatus = useResource<THREE.Texture>(
    textureRequests.roughness_texture ?? '',
    'Texture2D'
  );
  const metallicStatus = useResource<THREE.Texture>(
    textureRequests.metallic_texture ?? '',
    'Texture2D'
  );
  const emissionStatus = useResource<THREE.Texture>(
    textureRequests.emission_texture ?? '',
    'Texture2D'
  );
  // Parity-audit fix: `ao_texture` now resolves and wires
  // through to `material.aoMap`. Was silently dropped because the slot
  // wasn't in `TEXTURE_PROPERTIES` pre-fix.
  const aoStatus = useResource<THREE.Texture>(
    textureRequests.ao_texture ?? '',
    'Texture2D'
  );
  const heightmapStatus = useResource<THREE.Texture>(
    textureRequests.heightmap_texture ?? '',
    'Texture2D'
  );
  const anisotropyFlowmapStatus = useResource<THREE.Texture>(
    textureRequests.anisotropy_flowmap ?? '',
    'Texture2D'
  );

  const textureSlots = useMemo(
    () => ({
      albedo_texture: textureRequests.albedo_texture ? albedoStatus : null,
      normal_texture: textureRequests.normal_texture ? normalStatus : null,
      roughness_texture: textureRequests.roughness_texture ? roughnessStatus : null,
      metallic_texture: textureRequests.metallic_texture ? metallicStatus : null,
      emission_texture: textureRequests.emission_texture ? emissionStatus : null,
      ao_texture: textureRequests.ao_texture ? aoStatus : null,
      heightmap_texture: textureRequests.heightmap_texture ? heightmapStatus : null,
      anisotropy_flowmap: textureRequests.anisotropy_flowmap ? anisotropyFlowmapStatus : null,
    }),
    [
      textureRequests,
      albedoStatus,
      normalStatus,
      roughnessStatus,
      metallicStatus,
      emissionStatus,
      aoStatus,
      heightmapStatus,
      anisotropyFlowmapStatus,
    ]
  );

  // Procedural texture slots resolve synchronously from the scene's internal
  // resources — a `SubResource(GradientTexture2D)` is fully described in the
  // scene, so it is rasterised here rather than fetched through `useResource`
  // like an ExtResource image. This is what gives the platformer coin its
  // additive gradient glow. Any slot NOT carrying a procedural sub-resource
  // stays undefined and falls back to the async `textureSlots` above.
  //
  // Not disposed here: a procedural texture is shared by every node pointing at
  // the same sub-resource and owned by the procedural cache, which frees it on
  // eviction. Freeing it per consumer would pull it out from under the others.
  // Pinned instead, so that eviction cannot free it while THIS node is still
  // sampling it — borrowing only works if the owner knows the borrow exists.
  const { textures: proceduralTextures, keys: proceduralKeys } = useMemo(
    () => resolveProceduralTextures(materialSubResource, internalResources),
    [materialSubResource, internalResources]
  );
  useProceduralTexturePins(proceduralKeys);

  // The per-material half of every texture binding: the UV transform
  // (`uv1_scale` / `uv1_offset`), the sampler filter (`texture_filter`) and the
  // wrapping (`texture_repeat`, whose default is applied to the shared texture
  // at load). The per-SLOT half — which slots decode sRGB — is added by
  // `bindSlotTexture`, which clones before mutating, so two MeshInstance3D nodes
  // sharing a texture path with different tiling, filtering or slot roles don't
  // clobber each other, and hands the original straight back when this binding
  // needs nothing of its own.
  //
  // A triplanar material tiles per WORLD unit, not across the
  // mesh's 0..1 UVs. For a PlaneMesh we reproduce that density by folding
  // the plane's size into the scale (repeat = size × uv1_scale) — otherwise
  // a 12×3.5 hallway floor stretched one texture copy and read "too big".
  const textureState = useMemo((): MaterialTextureState | null => {
    if (!materialScalars) return null;
    const scale =
      materialScalars.triplanar && meshResource
        ? triplanarPlaneScale(meshResource, materialScalars.uv1Scale)
        : materialScalars.uv1Scale;
    // PARITY LIMITATION (uv1_offset + world-triplanar): three.js applies
    // `offset` in UV space, but Godot's world-triplanar offset is in world
    // units, so a non-zero offset would shift by a different amount here. No
    // shipped scene sets uv1_offset, so impact is currently zero.
    return {
      uv: { scale, offset: materialScalars.uv1Offset },
      // Only an AUTHORED filter is a divergence. The scalars parser fills in
      // Godot's default, and passing that would clone every texture whose
      // sampler state merely differs from it — a procedural GradientTexture2D
      // has no mipmaps, so it would clone and re-upload per material per slot
      // for a filter no material asked for.
      filter:
        materialScalars.textureFilter === GODOT_TEXTURE_FILTER_DEFAULT
          ? undefined
          : materialScalars.textureFilter,
      repeat: materialScalars.textureRepeat,
    };
  }, [materialScalars, meshResource]);

  // A `SubResource(ViewportTexture)` albedo names a `<SubViewport>` rather than
  // a file, so it resolves through the live registry instead of the loader —
  // and it arrives AFTER first paint, once that sub-viewport has published.
  // Highest precedence of the three: nothing else can be in the slot when the
  // authored value is a ViewportTexture.
  const { texture: viewportAlbedo, cyclic: viewportAlbedoCyclic } = useViewportTextureSlot(
    (materialSubResource?.data as { albedo_texture?: string } | undefined)?.albedo_texture,
    internalResources
  );

  const albedoMap = useMemo(
    () =>
      transformedTexture(
        viewportAlbedo
          ? { value: viewportAlbedo }
          : effectiveSlot(proceduralTextures.albedo_texture, textureSlots.albedo_texture),
        textureState,
        'albedo_texture'
      ),
    [viewportAlbedo, proceduralTextures.albedo_texture, textureSlots.albedo_texture, textureState]
  );
  const normalMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.normal_texture, textureSlots.normal_texture),
        textureState,
        'normal_texture'
      ),
    [proceduralTextures.normal_texture, textureSlots.normal_texture, textureState]
  );
  // PARITY LIMITATION (metallic/roughness texture channel): Godot reads the
  // channel named by `metallic_texture_channel` / `roughness_texture_channel`
  // (default RED). three.js's metalnessMap/roughnessMap read fixed channels
  // (BLUE / GREEN). Faithful for grayscale or matching-channel (ORM) maps; a
  // RED-packed map with differing channels would misread. A true fix needs
  // runtime channel-swizzling.
  const roughnessMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.roughness_texture, textureSlots.roughness_texture),
        textureState,
        'roughness_texture'
      ),
    [proceduralTextures.roughness_texture, textureSlots.roughness_texture, textureState]
  );
  const metalnessMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.metallic_texture, textureSlots.metallic_texture),
        textureState,
        'metallic_texture'
      ),
    [proceduralTextures.metallic_texture, textureSlots.metallic_texture, textureState]
  );
  const emissiveMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.emission_texture, textureSlots.emission_texture),
        textureState,
        'emission_texture'
      ),
    [proceduralTextures.emission_texture, textureSlots.emission_texture, textureState]
  );
  const aoMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.ao_texture, textureSlots.ao_texture),
        textureState,
        'ao_texture'
      ),
    [proceduralTextures.ao_texture, textureSlots.ao_texture, textureState]
  );
  const displacementMap = useMemo(
    () =>
      transformedTexture(
        effectiveSlot(proceduralTextures.heightmap_texture, textureSlots.heightmap_texture),
        textureState,
        'heightmap_texture'
      ),
    [proceduralTextures.heightmap_texture, textureSlots.heightmap_texture, textureState]
  );
  // Depend on the two values the repack actually reads, not on their wrappers:
  // `materialScalars` and the slot object are re-created on every re-parse and
  // every re-emit of the same cached texture, and a repack is now a canvas
  // readback plus a full-buffer copy plus a GPU re-upload.
  const anisotropyStrength = materialScalars?.anisotropy ?? 0;
  const anisotropyFlowmap = textureSlots.anisotropy_flowmap?.value;
  const repackedFlowmap = useMemo(() => {
    // Only an anisotropy-enabled material renders as MeshPhysicalMaterial and
    // samples anisotropyMap; skip the repack and the slotKey churn when the
    // strength is 0 — the map would never be read on the standard-material
    // fallback.
    if (anisotropyStrength <= 0 || !anisotropyFlowmap) return undefined;
    return repackAnisotropyFlowmap(anisotropyFlowmap);
  }, [anisotropyStrength, anisotropyFlowmap]);

  const anisotropyMap = useMemo(
    () => transformedTexture({ value: repackedFlowmap }, textureState, 'anisotropy_flowmap'),
    [repackedFlowmap, textureState]
  );

  // The repack allocates its own pixel buffer, so it is disposed on the same
  // terms as the procedural DataTextures above. The binding may hand back a
  // CLONE of it, and the clone is what the material samples: three keys its GPU
  // texture on the sampler parameters, so a clone that changes wrapS/wrapT or
  // colour space gets an upload of its own while the original is never uploaded
  // at all — disposing only the original frees nothing. When nothing diverged
  // they are the same object and one dispose is enough.
  useEffect(() => {
    return () => {
      repackedFlowmap?.dispose();
      if (anisotropyMap !== repackedFlowmap) anisotropyMap?.dispose();
    };
  }, [repackedFlowmap, anisotropyMap]);

  // Every OTHER slot's binding may equally have produced a clone, and each one
  // is a GPU upload of its own. `releaseBoundTexture` frees exactly those and
  // leaves the loader's shared cache entries alone, so a slot that needed
  // nothing costs nothing here. Listed rather than folded into an array literal
  // in the dependency list, which would be a new array every render and free
  // the textures the material is still sampling.
  //
  // Same shape as the flowmap effect above and as the per-clone dispose the
  // colour-space retag used to carry inside the material slot, so the exposure
  // is unchanged: under StrictMode's mount → unmount → mount the cleanup fires
  // once on a still-live clone. three's dispose is refcounted per source and
  // clears only the renderer's per-texture properties — the pixels live on the
  // shared `source` — so the remount re-uploads rather than sampling nothing.
  // Replacement is ordered safely: R3F applies the new props during commit,
  // before React runs this cleanup for the old ones.
  useEffect(() => {
    return () => {
      releaseBoundTexture(albedoMap);
      releaseBoundTexture(normalMap);
      releaseBoundTexture(roughnessMap);
      releaseBoundTexture(metalnessMap);
      releaseBoundTexture(emissiveMap);
      releaseBoundTexture(aoMap);
      releaseBoundTexture(displacementMap);
    };
  }, [albedoMap, normalMap, roughnessMap, metalnessMap, emissiveMap, aoMap, displacementMap]);

  // If any requested slot resolved to `unavailable`, surface the FIRST
  // such path as the placeholder label. Listing more than one would
  // bury the user under text.
  const firstMissingPath = useMemo(() => {
    for (const slot of TEXTURE_PROPERTIES) {
      const result = textureSlots[slot];
      const requested = textureRequests[slot];
      if (result && result.status === 'unavailable' && requested) {
        return requested;
      }
    }
    return null;
  }, [textureSlots, textureRequests]);

  // A ViewportTexture albedo whose target's pass is cyclic never renders —
  // same visible fact as a missing file, so it takes the same magenta
  // placeholder branch below rather than silently sampling the unwritten
  // target (`useViewportTextureSlot`'s `cyclic`).
  const materialUnresolved = firstMissingPath !== null || viewportAlbedoCyclic;

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

  // cast_shadow mode 2 (DOUBLE_SIDED) sets material.shadowSide = DoubleSide;
  // mode 3 (SHADOWS_ONLY) hides the mesh from the colour buffer while it keeps
  // casting — see MeshShell for why that is NOT `visible = false`.
  const shadowFlags = shadowCastingFlags(properties.castShadow);
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
    godotLayers: properties.layers,
    subtree: children,
  };

  // Unresolved mesh (no mesh, external GLB, missing SubResource): magenta
  // wireframe placeholder. An external ArrayMesh (`arrayMeshPath`) is NOT
  // unresolved — it loads asynchronously below.
  if (!meshResource && !arrayMeshPath) {
    return <MeshShell {...shellProps}>{UNRESOLVED_MESH}</MeshShell>;
  }

  // External ArrayMesh: surface its load states. `unavailable` → the .tres
  // couldn't be loaded, show the magenta placeholder; `pending` → render
  // nothing until the geometry arrives (the node still lives in the tree view).
  if (arrayMeshPath) {
    if (arrayMeshResult.status === 'unavailable') {
      return <MeshShell {...shellProps}>{UNRESOLVED_MESH}</MeshShell>;
    }
    // Still loading: draw no geometry, but keep the shell so the node's own
    // descendants (which do not depend on the .tres) stay mounted meanwhile.
    if (!arrayMeshResult.value) return <MeshShell {...shellProps}>{null}</MeshShell>;

    return (
      <MeshShell {...shellProps}>
        <ArrayMeshSurfaces
          mesh={arrayMeshResult.value}
          overrides={meshOverrides}
          shadowSide={shadowFlags.shadowSide}
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
            shadowSide={shadowFlags.shadowSide}
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
      <MeshShell {...shellProps}>
        {geometryElement}
        <meshStandardMaterial color="magenta" />
      </MeshShell>
    );
  }

  // Multi-surface meshes (slot N>0 populated): attach the primary material at
  // `material-0` so R3F builds an array and the secondary slots can land at
  // `material-N`. Single-surface meshes omit `attach` to keep `mesh.material` a
  // singular Material.
  const primaryAttach = materialSources.length > 1 ? 'material-0' : undefined;

  return (
    <MeshShell {...shellProps}>
      {geometryElement}
      {primarySource?.kind === 'path' ? (
        <ExternalMaterialSlot
          path={primarySource.path}
          attach={primaryAttach}
          shadowSide={shadowFlags.shadowSide}
        />
      ) : (
        <StandardMaterialSlot
          scalars={materialScalars}
          albedoMap={albedoMap}
          normalMap={normalMap}
          roughnessMap={roughnessMap}
          metalnessMap={metalnessMap}
          emissiveMap={emissiveMap}
          aoMap={materialScalars?.aoEnabled ? aoMap : undefined}
          displacementMap={displacementMap}
          anisotropyMap={anisotropyMap}
          shadowSide={shadowFlags.shadowSide}
          meshType={meshResource?.type}
          attach={primaryAttach}
        />
      )}
      {materialSources.slice(1).map((source, i) =>
        source?.kind === 'path' ? (
          <ExternalMaterialSlot
            key={`mat-${i + 1}`}
            path={source.path}
            attach={`material-${i + 1}`}
            shadowSide={shadowFlags.shadowSide}
          />
        ) : (
          <SecondarySurfaceMaterial
            key={`mat-${i + 1}`}
            attach={`material-${i + 1}`}
            subResource={source?.resource}
            shadowSide={shadowFlags.shadowSide}
          />
        )
      )}
    </MeshShell>
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
  /** `layers` — the VisualInstance3D render mask a Decal's `cull_mask` filters on. */
  godotLayers: number | undefined;
  /** The dispatched scene-tree subtree parented under this MeshInstance3D. */
  subtree: ReactNode;
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
  godotLayers,
  subtree,
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
        <meshBasicMaterial attach="material" colorWrite={false} depthWrite={false} />
      )}
      {subtree}
    </mesh>
  );
}

interface SecondarySurfaceMaterialProps {
  attach: string;
  subResource: TscnInternalResource | undefined;
  shadowSide?: THREE.Side;
}

/**
 * Material attached at `material-N` (N > 0) for multi-surface meshes.
 *
 * Scalar properties only — texture slots are unwired, not unreachable. This is a
 * component rendered once per surface, so it may call `useResource` itself, as
 * `ExternalMaterialSlot` does for the external-ArrayMesh path.
 *
 * An unpopulated slot gets Godot's default 3D material: the renderer's fallback
 * is per surface index, not per mesh, so a slot past the material array is
 * exactly the material-less case surface 0 would hit.
 */
function SecondarySurfaceMaterial({
  attach,
  subResource,
  shadowSide,
}: SecondarySurfaceMaterialProps) {
  if (!subResource) {
    return (
      <meshStandardMaterial
        attach={attach}
        color={GODOT_DEFAULT_ALBEDO}
        metalness={GODOT_DEFAULT_METALLIC}
        roughness={GODOT_DEFAULT_ROUGHNESS}
        shadowSide={shadowSide ?? null}
      />
    );
  }
  const scalars = parseStandardMaterial3DScalars(
    subResource.data as Record<string, string>
  );
  // Through the same resolution slot 0 uses, so one mesh cannot show two results
  // for the same material. These slots never load a texture (see above), which is
  // exactly the case where `emission_operator = MULTIPLY` collapses to no emission
  // at all — Godot's absent sampler reads black.
  const emission = resolveEmission(scalars, scalars.emissionOperator, false);
  return (
    <meshStandardMaterial
      attach={attach}
      color={scalars.color}
      metalness={scalars.metalness}
      roughness={scalars.roughness}
      transparent={scalars.transparent}
      opacity={scalars.opacity}
      {...materialBlendProps(scalars)}
      depthTest={scalars.depthTest}
      side={scalars.side}
      shadowSide={shadowSide ?? null}
      emissive={emission.emissive}
      emissiveIntensity={emission.emissiveIntensity}
    />
  );
}

/**
 * Clone the loaded texture (if any) with the material's own texture state
 * applied. Returns `undefined` when nothing is loaded yet, so the
 * `<meshStandardMaterial>` falls back to `null` for that slot.
 */
function transformedTexture(
  resolved: { value: THREE.Texture | undefined } | null,
  state: MaterialTextureState | null,
  slot: TextureSlot
): THREE.Texture | undefined {
  const value = resolved?.value;
  if (!value) return undefined;
  if (!state) return value;
  return bindSlotTexture(value, slot, state);
}

/**
 * A synchronously-resolved procedural texture (e.g. GradientTexture2D) takes
 * precedence over the async-loaded slot for the same map. Returns a
 * `transformedTexture`-shaped slot so the UV-transform path is shared.
 */
function effectiveSlot(
  procedural: THREE.Texture | undefined,
  asyncSlot: { value: THREE.Texture | undefined } | null
): { value: THREE.Texture | undefined } | null {
  return procedural ? { value: procedural } : asyncSlot;
}

interface ProceduralTextureSlots {
  textures: Partial<Record<TextureSlot, THREE.Texture>>;
  /** Cache keys for the slots that resolved — exactly those, so a key is never
   *  pinned for a texture the cache does not hold. */
  keys: string[];
}

/**
 * Rasterise every material texture slot that references an inline procedural
 * texture (currently `SubResource(GradientTexture2D)`) into a THREE.Texture,
 * collecting the cache keys those same slots must pin. Slots carrying an
 * ExtResource image, a non-gradient SubResource, or nothing are omitted,
 * leaving the async `useResource` path to handle them.
 *
 * One walk yields both: a second walk deriving keys on its own is free to
 * disagree with this one about which references are procedural.
 */
function resolveProceduralTextures(
  materialSubResource: TscnInternalResource | undefined,
  internalResources: readonly TscnInternalResource[]
): ProceduralTextureSlots {
  const out: ProceduralTextureSlots = { textures: {}, keys: [] };
  if (!materialSubResource) return out;
  const data = materialSubResource.data as Record<string, unknown>;
  for (const slot of TEXTURE_PROPERTIES) {
    const raw = data[slot];
    if (typeof raw !== 'string') continue;
    const resolved = resolveProceduralTexture(raw, internalResources);
    if (resolved) {
      out.textures[slot] = resolved.texture;
      out.keys.push(resolved.key);
    }
  }
  return out;
}

/**
 * What a mesh reference that resolves to nothing renders as. One value, because
 * three branches reach it: no mesh at all, an external `.tres` that failed, and a
 * scene sub-resource whose surfaces could not be read.
 */
const UNRESOLVED_MESH = (
  <>
    <boxGeometry args={[1, 1, 1]} />
    <meshBasicMaterial color={0xff00ff} wireframe />
  </>
);

/**
 * A decoded ArrayMesh's geometry plus one material slot per draw group. Each
 * surface's material is resolved through the pipeline by its own
 * `<ExternalMaterialSlot>`, which keeps `useResource` one-per-component (rules of
 * hooks) while still loading textured materials for every surface.
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
  shadowSide,
  sceneMaterials,
  overrides,
}: {
  mesh: ArrayMeshResource;
  shadowSide: THREE.Side | undefined;
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
        // A scene-local material is already in hand; only a PATH needs the pipeline.
        return source?.kind === 'scene' ? (
          <StandardMaterialSlot
            key={`surf-${i}`}
            scalars={parseStandardMaterial3DScalars(source.resource.data as Record<string, string>)}
            attach={attach}
            shadowSide={shadowSide}
          />
        ) : (
          <ExternalMaterialSlot
            key={`surf-${i}`}
            path={source?.path ?? null}
            attach={attach}
            shadowSide={shadowSide}
          />
        );
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
function resolveMaterialSources(
  properties: MeshInstance3DProperties,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): Array<MaterialSource | undefined> {
  const overrides = properties.surfaceMaterialOverrides;
  const surfaceSlots =
    overrides && overrides.size > 0
      ? Math.max(...Array.from(overrides.keys()), 0) + 1
      : 1;

  const meshOwn = findMeshOwnMaterial(properties.mesh, internalResources);

  const result: Array<MaterialSource | undefined> = new Array(surfaceSlots);
  for (let i = 0; i < surfaceSlots; i++) {
    // `material_override` first, and on EVERY surface: it is applied in
    // `_geometry_instance_add_surface`, which runs per surface, rather than as
    // a whole-mesh replacement. Only then the per-surface override, then the
    // mesh's own material — which exists for surface 0 alone on a primitive.
    const ref = properties.materialOverride ?? overrides?.get(i) ?? (i === 0 ? meshOwn : undefined);
    result[i] = resolveMaterialSource(ref, internalResources, externalResources);
  }
  return result;
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


/**
 * Walk the material's texture slots and resolve each `ExtResource("id")`
 * reference to the underlying path string. Returns `{ slot: path | undefined }`
 * so the caller can fan out to `useResource` for each.
 */
function collectTextureRequests(
  materialSubResource: TscnInternalResource | undefined,
  externalResources: readonly TscnExternalResource[]
): Partial<Record<TextureSlot, string>> {
  if (!materialSubResource) return {};
  const out: Partial<Record<TextureSlot, string>> = {};
  const data = materialSubResource.data as Record<string, unknown>;
  for (const slot of TEXTURE_PROPERTIES) {
    const raw = data[slot];
    if (typeof raw !== 'string') continue;
    const parsed = parseResourceReference(raw);
    if (!parsed || parsed.type !== 'ExtResource') continue;
    const ext = externalResources.find((r) => r.id === parsed.id);
    if (ext?.path) {
      out[slot] = ext.path;
    }
  }
  return out;
}

interface ShadowFlags {
  castShadow: boolean;
  /** Mesh still casts a shadow but isn't drawn into the colour buffer. */
  shadowsOnly: boolean;
  /** Override material.shadowSide so both faces participate in the shadow pass. */
  shadowSide?: THREE.Side;
}

/**
 * Decode Godot's `cast_shadow` enum (0=OFF, 1=ON, 2=DOUBLE_SIDED,
 * 3=SHADOWS_ONLY) into the three flags the renderer needs. Previously
 * only the boolean was returned and modes 2 and 3 collapsed silently to
 * castShadow=true.
 */
function shadowCastingFlags(value: number | undefined): ShadowFlags {
  // class_geometryinstance3d.html: cast_shadow defaults to 1
  // (SHADOW_CASTING_SETTING_ON), so an absent key means the mesh DOES cast.
  if (value === 0) {
    return { castShadow: false, shadowsOnly: false };
  }
  if (value === 2) {
    return { castShadow: true, shadowsOnly: false, shadowSide: THREE.DoubleSide };
  }
  if (value === 3) {
    return { castShadow: true, shadowsOnly: true };
  }
  return { castShadow: true, shadowsOnly: false };
}

export { THREE };
