/**
 * One surface's material, textures and all. Godot binds a material per surface,
 * so texture resolution lives in a component rendered once per surface, which
 * keeps `useResource` one call per component for any surface count.
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
   * The first slot whose file could not load: more would bury the user in text.
   * The node decides whether that diverts the mesh to a placeholder, then mounts
   * `<StandardMaterialSlot>` with this hook's maps, since a second hook call
   * would bind and dispose every slot twice.
   */
  firstMissingPath: string | null;
  /**
   * The albedo slot names a ViewportTexture whose pass is cyclic: it never
   * renders, the same visible fact as a missing file.
   */
  viewportCyclic: boolean;
}

/**
 * Resolve every texture slot of one scene-local StandardMaterial3D, from gated
 * references through loads, precedence and binding to the eight three maps. A
 * triplanar material tiles per world unit, so `triplanarMesh` folds in a PlaneMesh's
 * size. CSG and GridMap pass nothing and get the material's own `uv1_scale`.
 */
export function useMaterialTextures(
  scalars: StandardMaterial3DScalars | null,
  triplanarMesh?: TscnInternalResource
): ResolvedMaterialTextures {
  const { internalResources, externalResources } = useSceneResources();

  // The decode's gated table, never the raw property bag: Godot declares and
  // samples a gated slot's sampler only inside its `if (features[…])` branch
  // (`scene/resources/material.cpp:1090,1745`), so a `normal_texture` without
  // `normal_enabled` reaches no shader at all.
  const references = scalars?.textureSlots;

  const textureRequests = useMemo(
    () => collectTextureRequests(references, externalResources),
    [references, externalResources]
  );

  // Hooks must be called unconditionally, in stable order, so every slot calls
  // `useResource` even when it has no path. The hook treats `''` as a no-op.
  const albedoStatus = useResource<THREE.Texture>(textureRequests.albedo_texture ?? '', 'texture');
  const normalStatus = useResource<THREE.Texture>(textureRequests.normal_texture ?? '', 'texture');
  const roughnessStatus = useResource<THREE.Texture>(
    textureRequests.roughness_texture ?? '',
    'texture'
  );
  const metallicStatus = useResource<THREE.Texture>(
    textureRequests.metallic_texture ?? '',
    'texture'
  );
  const emissionStatus = useResource<THREE.Texture>(
    textureRequests.emission_texture ?? '',
    'texture'
  );
  const aoStatus = useResource<THREE.Texture>(textureRequests.ao_texture ?? '', 'texture');
  const heightmapStatus = useResource<THREE.Texture>(
    textureRequests.heightmap_texture ?? '',
    'texture'
  );
  const anisotropyFlowmapStatus = useResource<THREE.Texture>(
    textureRequests.anisotropy_flowmap ?? '',
    'texture'
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
  // the scene, so it rasterises here. The procedural cache owns and shares it,
  // so it is pinned against eviction rather than disposed.
  const { textures: proceduralTextures, keys: proceduralKeys } = useMemo(
    () => resolveProceduralTextures(references, internalResources),
    [references, internalResources]
  );
  useProceduralTexturePins(proceduralKeys);

  // The per-material half of every binding: UV transform, sampler filter and
  // wrapping. The per-slot half (which slots decode sRGB) is `bindSlotTexture`'s.
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
      // Only an authored filter is a divergence, and passing Godot's default would
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

  // The binding may hand back a clone of the repack with its own upload. Only
  // the clone is a second object: when nothing diverged the two are one texture,
  // and the repack effect below owns it.
  const anisotropyClone = anisotropyMap === repackedFlowmap ? undefined : anisotropyMap;

  // One effect per texture: a shared dependency list runs every cleanup when any
  // slot resolves, freeing still-bound textures that three then re-uploads.
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
  /** R3F attach key: `material` for a single surface, `material-N` for many. */
  attach?: string;
  /** The mesh sub-resource a triplanar material folds into its tiling, if any. */
  triplanarMesh?: TscnInternalResource;
}

/**
 * One surface's material slot: a scene `[sub_resource]`, resolved here with its
 * textures, or a `.tres` that `<ExternalMaterialSlot>` gets whole from the
 * material pipeline. The engine cannot tell the two apart, so neither can a surface.
 */
export function SurfaceMaterialSlot({ source, attach, triplanarMesh }: SurfaceMaterialSlotProps) {
  if (source?.kind === 'path') {
    return <ExternalMaterialSlot path={source.path} attach={attach} />;
  }
  // `'default'` and an absent source reach the same slot: a surface with no
  // usable material draws Godot's default one, and `SceneMaterialSlot` builds
  // exactly that from a null resource (ADR-0041).
  return (
    <SceneMaterialSlot
      resource={source?.kind === 'scene' ? source.resource : undefined}
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

/** Frees one binding-owned texture clone when that texture changes, and only then. */
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
