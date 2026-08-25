/**
 * One surface's material, textures and all.
 *
 * Godot binds a material PER SURFACE and `_update_shader` emits the same
 * samplers for each, so texture resolution cannot live in a node's function
 * body where only the primary material can reach it. It lives here, in a
 * component rendered once per surface, which is what keeps `useResource`
 * one-call-per-component (rules of hooks) for an arbitrary surface count.
 *
 * Two halves, deliberately separate:
 *   - `useMaterialTextures` — the per-surface resolution chain: gated slot
 *     references → loads → procedural/viewport precedence → per-material
 *     binding → the eight three maps. Everything it needs is the MATERIAL's,
 *     plus the one node-level datum a triplanar material folds in (see the
 *     `triplanarMesh` parameter).
 *   - `SurfaceMaterialSlot` — the mount: dispatches a resolved `MaterialSource`
 *     to that chain (a scene `[sub_resource]`) or to `<ExternalMaterialSlot>`
 *     (a `.tres`, whose textures the material pipeline resolves instead).
 *
 * What stays with the NODE: whether an unresolved texture diverts the whole
 * mesh to a placeholder — that decision is per-mesh, so the node calls the hook
 * itself for its primary material and reads `firstMissingPath` / `viewportCyclic`
 * off it. Calling the hook once at the node AND again through this component for
 * the same surface would bind (and later dispose) every slot twice, so the
 * primary surface of a node that needs the decision mounts
 * `<StandardMaterialSlot>` with the hook's maps directly.
 */

import * as THREE from 'three';
import { useEffect, useMemo } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { parseResourceReference } from '../../resources/SubResourceResolver';
import { resolveProceduralTexture } from '../../resources/textures/resolveProceduralTexture';
import { useViewportTextureSlot } from '../../resources/textures/viewporttexture/useViewportTextureSlot';
import { useProceduralTexturePins } from '../../resources/useProceduralTexture';
import { useResource } from '../../resources/useResource';
import { useSceneResources } from '../SceneResourcesContext';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import type {
  StandardMaterial3DScalars,
  TextureSlot,
  TextureSlotReferences,
} from '../../resources/materials/standardmaterial3d/types';
import { TEXTURE_SLOTS } from '../../resources/materials/standardmaterial3d/types';
import {
  bindSlotTexture,
  releaseBoundTexture,
} from '../../resources/materials/standardmaterial3d/textureBinding';
import type { MaterialTextureState } from '../../resources/textures/applyTextureState';
import { GODOT_TEXTURE_FILTER_DEFAULT } from '../../resources/textures/godotTextureFilter';
import { repackAnisotropyFlowmap } from '../../resources/textures/repackFlowmap';
import { triplanarPlaneScale } from '../../nodes/3d/meshinstance3d/triplanarScale';
import { StandardMaterialSlot } from './StandardMaterialSlot';
import { ExternalMaterialSlot } from './ExternalMaterialSlot';
import type { MaterialSource } from './materialSource';
import type { MaterialTextureMaps } from './materialTextureMaps';

export type { MaterialTextureMaps };


export interface ResolvedMaterialTextures {
  maps: MaterialTextureMaps;
  /**
   * The FIRST slot whose file could not be loaded. Listing more than one would
   * bury the user under text. Reported rather than acted on: what an
   * unresolvable texture does to the surface is the caller's policy.
   */
  firstMissingPath: string | null;
  /**
   * The albedo slot names a ViewportTexture whose pass is cyclic — it never
   * renders, the same visible fact as a missing file.
   */
  viewportCyclic: boolean;
}

/**
 * Resolve every texture slot of ONE scene-local StandardMaterial3D.
 *
 * `triplanarMesh` is the node-level datum this chain cannot derive: a triplanar
 * material tiles per WORLD unit, so a PlaneMesh's size folds into the scale.
 * Nodes with no mesh sub-resource (CSG, GridMap) pass nothing and get the
 * material's own `uv1_scale`.
 */
export function useMaterialTextures(
  scalars: StandardMaterial3DScalars | null,
  triplanarMesh?: TscnInternalResource
): ResolvedMaterialTextures {
  const { internalResources, externalResources } = useSceneResources();

  // The decode's GATED table, never the raw property bag: Godot declares and
  // samples a gated slot's sampler only inside its `if (features[…])` branch
  // (`scene/resources/material.cpp:1090,1745`), so a `normal_texture` without
  // `normal_enabled` reaches no shader at all.
  const references = scalars?.textureSlots;

  const textureRequests = useMemo(
    () => collectTextureRequests(references, externalResources),
    [references, externalResources]
  );

  // Hooks must be called unconditionally, in stable order, so every slot calls
  // `useResource` even when it has no path — the hook treats `''` as a no-op.
  const albedoStatus = useResource<THREE.Texture>(textureRequests.albedo_texture ?? '', 'Texture2D');
  const normalStatus = useResource<THREE.Texture>(textureRequests.normal_texture ?? '', 'Texture2D');
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
  const aoStatus = useResource<THREE.Texture>(textureRequests.ao_texture ?? '', 'Texture2D');
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

  // A procedural slot (`SubResource(GradientTexture2D)`) is fully described in
  // the scene, so it rasterises here rather than loading. Not disposed: the
  // procedural cache owns it and every node pointing at the same sub-resource
  // shares it — pinned instead, so eviction cannot free it under this consumer.
  const { textures: proceduralTextures, keys: proceduralKeys } = useMemo(
    () => resolveProceduralTextures(references, internalResources),
    [references, internalResources]
  );
  useProceduralTexturePins(proceduralKeys);

  // The per-material half of every binding: UV transform, sampler filter and
  // wrapping. The per-SLOT half (which slots decode sRGB) is `bindSlotTexture`'s.
  const textureState = useMemo((): MaterialTextureState | null => {
    if (!scalars) return null;
    const scale =
      scalars.triplanar && triplanarMesh
        ? triplanarPlaneScale(triplanarMesh, scalars.uv1Scale)
        : scalars.uv1Scale;
    // PARITY LIMITATION (uv1_offset + world-triplanar): three applies `offset`
    // in UV space, Godot's world-triplanar offset is in world units.
    return {
      uv: { scale, offset: scalars.uv1Offset },
      // Only an AUTHORED filter is a divergence; passing Godot's default would
      // clone every texture for a sampler state no material asked for.
      filter:
        scalars.textureFilter === GODOT_TEXTURE_FILTER_DEFAULT ? undefined : scalars.textureFilter,
      repeat: scalars.textureRepeat,
    };
  }, [scalars, triplanarMesh]);

  // A ViewportTexture albedo names a `<SubViewport>`, not a file: it resolves
  // through the live registry and arrives after first paint. Highest precedence
  // of the three sources for this slot.
  const { texture: viewportAlbedo, cyclic: viewportCyclic } = useViewportTextureSlot(
    references?.albedo_texture,
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
  // (default RED); three's metalnessMap/roughnessMap read BLUE / GREEN.
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

  // Depend on the two values the repack reads, not their wrappers: a repack is a
  // canvas readback plus a full-buffer copy plus a GPU re-upload.
  const anisotropyStrength = scalars?.anisotropy ?? 0;
  const anisotropyFlowmap = textureSlots.anisotropy_flowmap?.value;
  const repackedFlowmap = useMemo(() => {
    // Only an anisotropy-enabled material renders as MeshPhysicalMaterial and
    // samples anisotropyMap.
    if (anisotropyStrength <= 0 || !anisotropyFlowmap) return undefined;
    return repackAnisotropyFlowmap(anisotropyFlowmap);
  }, [anisotropyStrength, anisotropyFlowmap]);

  const anisotropyMap = useMemo(
    () => transformedTexture({ value: repackedFlowmap }, textureState, 'anisotropy_flowmap'),
    [repackedFlowmap, textureState]
  );

  // The repack allocates its own pixel buffer, and the binding may hand back a
  // CLONE of it that gets an upload of its own — disposing only the original
  // frees nothing. Only the clone is this pair's second object; when nothing
  // diverged the two are one texture and the repack effect below owns it.
  const anisotropyClone = anisotropyMap === repackedFlowmap ? undefined : anisotropyMap;

  // ONE EFFECT PER TEXTURE. A shared dependency list would run every cleanup
  // the moment any single slot resolved, freeing the GPU texture of the slots
  // that did NOT change while the mounted material still had them bound —
  // three then re-uploads each of them on the next frame.
  useDisposeTexture(repackedFlowmap);
  useDisposeTexture(anisotropyClone);
  useReleaseBoundTexture(albedoMap);
  useReleaseBoundTexture(normalMap);
  useReleaseBoundTexture(roughnessMap);
  useReleaseBoundTexture(metalnessMap);
  useReleaseBoundTexture(emissiveMap);
  useReleaseBoundTexture(aoMap);
  useReleaseBoundTexture(displacementMap);

  const firstMissingPath = useMemo(() => {
    for (const slot of TEXTURE_SLOTS) {
      const result = textureSlots[slot];
      const requested = textureRequests[slot];
      if (result && result.status === 'unavailable' && requested) return requested;
    }
    return null;
  }, [textureSlots, textureRequests]);

  const maps = useMemo(
    (): MaterialTextureMaps => ({
      albedoMap,
      normalMap,
      roughnessMap,
      metalnessMap,
      emissiveMap,
      aoMap,
      displacementMap,
      anisotropyMap,
    }),
    [
      albedoMap,
      normalMap,
      roughnessMap,
      metalnessMap,
      emissiveMap,
      aoMap,
      displacementMap,
      anisotropyMap,
    ]
  );

  return { maps, firstMissingPath, viewportCyclic };
}

export interface SurfaceMaterialSlotProps {
  /** The material this surface renders with; undefined = the renderer's default. */
  source: MaterialSource | undefined;
  /** R3F attach key — `material` for a single surface, `material-N` for many. */
  attach?: string;
  /** The mesh sub-resource a triplanar material folds into its tiling, if any. */
  triplanarMesh?: TscnInternalResource;
}

/**
 * One surface's material slot, whichever way the material arrived — a
 * `[sub_resource]` of the scene (resolved here, textures included) or a `.tres`
 * (resolved whole by the material pipeline). The engine cannot tell the two
 * apart, so neither can a surface.
 */
export function SurfaceMaterialSlot({ source, attach, triplanarMesh }: SurfaceMaterialSlotProps) {
  if (source?.kind === 'path') {
    return <ExternalMaterialSlot path={source.path} attach={attach} />;
  }
  return (
    <SceneMaterialSlot
      resource={source?.resource}
      attach={attach}
      triplanarMesh={triplanarMesh}
    />
  );
}

interface SceneMaterialSlotProps {
  /** A scene-local StandardMaterial3D, or undefined for an unpopulated slot. */
  resource: TscnInternalResource | undefined;
  attach?: string;
  triplanarMesh?: TscnInternalResource;
}

/**
 * A scene-local material rendered with its textures resolved. Split from
 * `SurfaceMaterialSlot` so the branch above calls no hook conditionally.
 */
function SceneMaterialSlot({ resource, attach, triplanarMesh }: SceneMaterialSlotProps) {
  const scalars = useMemo(
    () =>
      resource ? parseStandardMaterial3DScalars(resource.data as Record<string, string>) : null,
    [resource]
  );
  const { maps } = useMaterialTextures(scalars, triplanarMesh);
  return (
    <StandardMaterialSlot scalars={scalars} attach={attach} {...maps} />
  );
}

/**
 * Resolve each gated slot reference that names an `ExtResource` to its path, so
 * the caller can fan out to `useResource`. A `SubResource` reference (procedural
 * or ViewportTexture) is not a path and is deliberately dropped here.
 */
function collectTextureRequests(
  references: TextureSlotReferences | undefined,
  externalResources: readonly TscnExternalResource[]
): Partial<Record<TextureSlot, string>> {
  const out: Partial<Record<TextureSlot, string>> = {};
  if (!references) return out;
  for (const slot of TEXTURE_SLOTS) {
    const raw = references[slot];
    if (typeof raw !== 'string') continue;
    const parsed = parseResourceReference(raw);
    if (!parsed || parsed.type !== 'ExtResource') continue;
    const ext = externalResources.find((r) => r.id === parsed.id);
    if (ext?.path) out[slot] = ext.path;
  }
  return out;
}

interface ProceduralTextureSlots {
  textures: Partial<Record<TextureSlot, THREE.Texture>>;
  /** Cache keys for exactly the slots that resolved, so none is pinned in vain. */
  keys: string[];
}

/**
 * Rasterise every slot referencing an inline procedural texture, collecting the
 * cache keys those same slots must pin. One walk yields both: a second walk
 * deriving keys on its own is free to disagree about which refs are procedural.
 */
function resolveProceduralTextures(
  references: TextureSlotReferences | undefined,
  internalResources: readonly TscnInternalResource[]
): ProceduralTextureSlots {
  const out: ProceduralTextureSlots = { textures: {}, keys: [] };
  if (!references) return out;
  for (const slot of TEXTURE_SLOTS) {
    const raw = references[slot];
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
 * Clone the loaded texture (if any) with the material's own texture state
 * applied. Undefined when nothing is loaded yet, so the slot falls back to null.
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
 * A synchronously-resolved procedural texture takes precedence over the async
 * slot for the same map.
 */
function effectiveSlot(
  procedural: THREE.Texture | undefined,
  asyncSlot: { value: THREE.Texture | undefined } | null
): { value: THREE.Texture | undefined } | null {
  return procedural ? { value: procedural } : asyncSlot;
}

/** Frees one binding-owned texture clone when THAT texture changes, and only then. */
function useReleaseBoundTexture(texture: THREE.Texture | undefined): void {
  useEffect(() => {
    const own = texture;
    return () => releaseBoundTexture(own);
  }, [texture]);
}

/** Same, for a texture this module allocated itself rather than through the binding. */
function useDisposeTexture(texture: THREE.Texture | undefined): void {
  useEffect(() => {
    const own = texture;
    return () => own?.dispose();
  }, [texture]);
}
