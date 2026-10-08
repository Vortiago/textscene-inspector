/**
 * One surface's material, textures and all, or the magenta placeholder when a texture
 * never draws. Godot binds a material per surface, so texture resolution lives in a
 * component rendered once per surface, which keeps `useResource` one call per component
 * for any surface count.
 */

import * as THREE from 'three';
import { useEffect, useMemo } from 'react';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { findExtResource, parseResourceReference } from '../../resources/SubResourceResolver';
import { useViewportTextureSlot } from '../../resources/textures/viewporttexture/useViewportTextureSlot';
import { useProceduralTextures, type ProceduralSlot } from '../../resources/useProceduralTexture';
import { useTiledUpload } from '../tiledUpload/useTiledUpload';
import { useResource } from '../../resources/useResource';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import type {
  StandardMaterial3DScalars,
  TextureSlot,
  TextureSlotReferences,
} from '../../resources/materials/standardmaterial3d/types';
import { TEXTURE_SLOTS } from '../../resources/materials/standardmaterial3d/types';
import { MISSING_TEXTURE_MATERIAL } from '../../resources/materials/standardmaterial3d/materialBag';
import {
  bindSlotTexture,
  materialTextureState,
  releaseBoundTexture,
} from '../../resources/materials/standardmaterial3d/textureBinding';
import type { MaterialTextureState } from '../../resources/textures/applyTextureState';
import { repackAnisotropyFlowmap } from '../../resources/textures/repackFlowmap';
import { triplanarPlaneScale } from '../../nodes/3d/meshinstance3d/triplanarScale';
import { materialBagElement, StandardMaterialSlot } from './StandardMaterialSlot';
import { pendingMapStandIn } from './pendingMapStandIn';
import type { MaterialResource, MaterialSource } from './materialSource';
import { readyMaterial, useMaterial } from './useMaterial';
import type { MaterialTextureMaps } from './materialTextureMaps';

export type { MaterialTextureMaps };

export interface ResolvedMaterialTextures {
  maps: MaterialTextureMaps;
  /**
   * A slot's file could not load, or the albedo slot names a ViewportTexture whose pass is
   * cyclic. Either texture never draws, so the surface takes `MISSING_TEXTURE_MATERIAL`.
   */
  isUnresolved: boolean;
}

/** The resource tables a material's references resolve in: its owning file's. */
export type MaterialTables = Pick<MaterialResource, 'internalResources' | 'externalResources'>;

const NO_TABLES: MaterialTables = { internalResources: [], externalResources: [] };

/**
 * Resolve every texture slot of one StandardMaterial3D, from gated references through
 * loads, precedence and binding to the eight three maps. Each reference resolves in
 * `tables`, the material's own file, whichever file that is. A triplanar material tiles
 * per world unit, so `triplanarMesh` folds in a PlaneMesh's size. CSG and GridMap pass
 * nothing and get the material's own `uv1_scale`.
 */
export function useMaterialTextures(
  scalars: StandardMaterial3DScalars | null,
  tables: MaterialTables | null,
  triplanarMesh?: TscnInternalResource
): ResolvedMaterialTextures {
  const { internalResources, externalResources } = tables ?? NO_TABLES;

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
  const roughnessStatus = useResource<THREE.Texture>(textureRequests.roughness_texture ?? '', 'texture');
  const metallicStatus = useResource<THREE.Texture>(textureRequests.metallic_texture ?? '', 'texture');
  const emissionStatus = useResource<THREE.Texture>(textureRequests.emission_texture ?? '', 'texture');
  const aoStatus = useResource<THREE.Texture>(textureRequests.ao_texture ?? '', 'texture');
  const heightmapStatus = useResource<THREE.Texture>(textureRequests.heightmap_texture ?? '', 'texture');
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

  // A procedural slot (`SubResource(GradientTexture2D)`, `SubResource(NoiseTexture2D)`) is
  // fully described in the scene, so it resolves here: a gradient at once, a noise texture
  // when its build lands. The procedural cache owns and shares it, and the hook pins it.
  const proceduralSlots = useProceduralTextures(
    TEXTURE_SLOTS.map((slot) => textureSlotReference(references, slot)),
    internalResources
  );
  const proceduralTextures = proceduralTexturesBySlot(proceduralSlots);
  // A slot whose map is still loading or building binds a stand-in, never nothing.
  const isArriving = (slot: TextureSlot): boolean =>
    textureSlots[slot]?.status === 'pending' ||
    (proceduralSlots[TEXTURE_SLOTS.indexOf(slot)]?.building ?? false);

  // The per-material half of every binding: UV transform, sampler filter and
  // wrapping. The per-slot half (which slots decode sRGB) is `bindSlotTexture`'s.
  const textureState = useMemo((): MaterialTextureState | null => {
    if (!scalars) return null;
    const state = materialTextureState(scalars);
    if (!scalars.triplanar || !triplanarMesh) return state;
    // PARITY LIMITATION (uv1_offset + world-triplanar): three applies `offset`
    // in UV space, Godot's world-triplanar offset is in world units.
    return {
      ...state,
      uv: { scale: triplanarPlaneScale(triplanarMesh, scalars.uv1Scale), offset: scalars.uv1Offset },
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

  const anisotropyBound = useMemo(
    () => transformedTexture({ value: repackedFlowmap }, textureState, 'anisotropy_flowmap'),
    [repackedFlowmap, textureState]
  );

  // The binding may hand back a clone of the repack with its own upload. Only
  // the clone is a second object: when nothing diverged the two are one texture,
  // and the repack effect below owns it.
  const anisotropyClone = anisotropyBound === repackedFlowmap ? undefined : anisotropyBound;

  // One effect per texture: a shared dependency list runs every cleanup when any
  // slot resolves, freeing still-bound textures that three then re-uploads.
  useDisposeTexture(repackedFlowmap);
  useDisposeTexture(anisotropyClone);
  // Each map draws once it is on the GPU: a large one uploads in bands, and its
  // slot keeps the map it had meanwhile. The hook releases each map it stops drawing.
  const albedoDrawn = orStandIn(useBoundMapUpload(albedoMap), albedoMap, isArriving, 'albedo_texture');
  const normalDrawn = orStandIn(useBoundMapUpload(normalMap), normalMap, isArriving, 'normal_texture');
  const roughnessDrawn = orStandIn(
    useBoundMapUpload(roughnessMap),
    roughnessMap,
    isArriving,
    'roughness_texture'
  );
  const metalnessDrawn = orStandIn(
    useBoundMapUpload(metalnessMap),
    metalnessMap,
    isArriving,
    'metallic_texture'
  );
  const emissiveDrawn = orStandIn(
    useBoundMapUpload(emissiveMap),
    emissiveMap,
    isArriving,
    'emission_texture'
  );
  const aoDrawn = orStandIn(useBoundMapUpload(aoMap), aoMap, isArriving, 'ao_texture');
  const displacementDrawn = orStandIn(
    useBoundMapUpload(displacementMap),
    displacementMap,
    isArriving,
    'heightmap_texture'
  );
  // Only an anisotropy-enabled material samples the flowmap, so only it waits for one.
  const anisotropyMap =
    anisotropyBound ??
    (anisotropyStrength > 0 && isArriving('anisotropy_flowmap')
      ? pendingMapStandIn('anisotropy_flowmap')
      : undefined);

  const isFileMissing = TEXTURE_SLOTS.some((slot) => textureSlots[slot]?.status === 'unavailable');

  const maps = useMemo(
    (): MaterialTextureMaps => ({
      albedoMap: albedoDrawn,
      normalMap: normalDrawn,
      roughnessMap: roughnessDrawn,
      metalnessMap: metalnessDrawn,
      emissiveMap: emissiveDrawn,
      aoMap: aoDrawn,
      displacementMap: displacementDrawn,
      anisotropyMap,
    }),
    [
      albedoDrawn,
      normalDrawn,
      roughnessDrawn,
      metalnessDrawn,
      emissiveDrawn,
      aoDrawn,
      displacementDrawn,
      anisotropyMap,
    ]
  );

  return { maps, isUnresolved: isFileMissing || viewportCyclic };
}

export interface SurfaceMaterialSlotProps {
  /** The material this surface renders with; undefined = the renderer's default. */
  source: MaterialSource | undefined;
  /** R3F attach key: `material` for a single surface, `material-N` for many (`surfaceAttach`). */
  attach?: string;
  /** The mesh sub-resource a triplanar material folds into its tiling, if any. */
  triplanarMesh?: TscnInternalResource;
  /** The drawing GeometryInstance3D's fade (`geometryFade`). Omitted for any other drawer. */
  fade?: number;
}

/**
 * One surface's material slot, textures and all, whichever file the material came from.
 * A surface with no usable material draws Godot's default one, which
 * `<StandardMaterialSlot>` builds from null scalars (ADR-0041). A surface whose texture
 * cannot load, or whose ViewportTexture albedo is cyclic, draws the magenta placeholder.
 */
export function SurfaceMaterialSlot({ source, attach, triplanarMesh, fade }: SurfaceMaterialSlotProps) {
  const material = readyMaterial(useMaterial(source));
  const scalars = useMaterialScalars(material);
  const { maps, isUnresolved } = useMaterialTextures(scalars, material, triplanarMesh);
  if (isUnresolved) return materialBagElement(MISSING_TEXTURE_MATERIAL, attach);
  return <StandardMaterialSlot scalars={scalars} attach={attach} fade={fade} {...maps} />;
}

/** The decoded scalars of `material`, or null for Godot's default surface. */
export function useMaterialScalars(material: MaterialResource | null): StandardMaterial3DScalars | null {
  const resource = material?.resource;
  return useMemo(() => (resource ? parseStandardMaterial3DScalars(resource.data) : null), [resource]);
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
    const ext = findExtResource(externalResources, parsed.id);
    if (ext?.path) out[slot] = ext.path;
  }
  return out;
}

function textureSlotReference(
  references: TextureSlotReferences | undefined,
  slot: TextureSlot
): string | undefined {
  const raw = references?.[slot];
  return typeof raw === 'string' ? raw : undefined;
}

/** The hook's results, indexed like `TEXTURE_SLOTS`, keyed by slot name. */
function proceduralTexturesBySlot(
  slots: readonly ProceduralSlot[]
): Partial<Record<TextureSlot, THREE.Texture>> {
  const textures: Partial<Record<TextureSlot, THREE.Texture>> = {};
  TEXTURE_SLOTS.forEach((slot, index) => {
    const texture = slots[index]?.texture;
    if (texture) textures[slot] = texture;
  });
  return textures;
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

/** A procedural texture takes precedence over the file-loaded slot for the same map. */
function effectiveSlot(
  procedural: THREE.Texture | undefined,
  asyncSlot: { value: THREE.Texture | undefined } | null
): { value: THREE.Texture | undefined } | null {
  return procedural ? { value: procedural } : asyncSlot;
}

/**
 * The map a slot draws: the uploaded one, else a stand-in while a bound map uploads or
 * the map is still arriving (`pendingMapStandIn.ts` says why), else nothing.
 */
function orStandIn(
  drawn: THREE.Texture | undefined,
  bound: THREE.Texture | undefined,
  isArriving: (slot: TextureSlot) => boolean,
  slot: TextureSlot
): THREE.Texture | undefined {
  if (drawn) return drawn;
  return bound || isArriving(slot) ? pendingMapStandIn(slot) : undefined;
}

/** One bound map as it draws: uploaded in bands where large, released once it no longer draws. */
function useBoundMapUpload(texture: THREE.Texture | undefined): THREE.Texture | undefined {
  return useTiledUpload(texture ?? null, releaseBoundTexture) ?? undefined;
}

/** Disposes a texture this module allocated itself, which no binding releases, once it is replaced or the slot unmounts. */
function useDisposeTexture(texture: THREE.Texture | undefined): void {
  useEffect(() => {
    const own = texture;
    return () => own?.dispose();
  }, [texture]);
}
