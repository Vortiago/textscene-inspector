/**
 * One surface's material, textures and all, or the magenta placeholder when a texture
 * never draws. Godot binds a material per surface, so texture resolution lives in a
 * component rendered once per surface, which keeps `useResource` one call per component
 * for any surface count.
 */

import * as THREE from 'three';
import { useEffect, useMemo } from 'react';
import type { TscnInternalResource } from '../../parser/types';
import {
  isViewportTextureRef,
  useViewportTextureSlot,
} from '../../resources/textures/viewporttexture/useViewportTextureSlot';
import { useTexture2DRid, type Texture2DResult } from '../../resources/useTexture2D';
import { useTiledUpload } from '../tiledUpload/useTiledUpload';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import type {
  StandardMaterial3DScalars,
  TextureSlot,
  TextureSlotReferences,
} from '../../resources/materials/standardmaterial3d/types';
import { TEXTURE_SLOTS } from '../../resources/materials/standardmaterial3d/types';
import {
  MISSING_TEXTURE_MATERIAL,
  isAnisotropic,
} from '../../resources/materials/standardmaterial3d/materialBag';
import {
  bindSlotTexture,
  materialTextureStates,
  slotReadsSourceColor,
  topDownV,
  type MaterialTextureStates,
  type UVSetState,
} from '../../resources/materials/standardmaterial3d/textureBinding';
import { UV2_CHANNEL } from '../../resources/meshes/uv2';
import { repackAnisotropyFlowmap } from '../../resources/textures/repackFlowmap';
import { releaseBoundTexture } from '../../resources/textures/applyTextureState';
import { triplanarPlaneScale } from '../../nodes/3d/meshinstance3d/triplanarScale';
import { materialBagElement, StandardMaterialSlot } from './StandardMaterialSlot';
import { defaultWhiteTexture } from './defaultWhiteTexture';
import { pendingMapStandIn } from './pendingMapStandIn';
import type { MaterialResource, MaterialSource } from './materialSource';
import { readyMaterial, useMaterial } from './useMaterial';
import type { MaterialTextureMaps } from './materialTextureMaps';

interface ResolvedMaterialTextures {
  maps: MaterialTextureMaps;
  /**
   * A slot's file could not load, or the albedo slot names a ViewportTexture whose pass is
   * cyclic. Either texture never draws, so the surface takes `MISSING_TEXTURE_MATERIAL`.
   */
  isUnresolved: boolean;
}

/** The resource tables a material's references resolve in: its owning file's. */
type MaterialTables = Pick<MaterialResource, 'internalResources' | 'externalResources'>;

const NO_TABLES: MaterialTables = { internalResources: [], externalResources: [] };

/** The glTF surface a GLB override draws on, whose UVs keep Godot's top-down V (`godot/math/uv.ts`). */
export const GLTF_SURFACE = 'gltf';

/**
 * What a material's textures draw on, where the binding cares: the Godot mesh sub-resource a
 * triplanar material tiles against, or a glTF surface. Stable identity, as a memo reads it.
 */
export type TexturedSurface = TscnInternalResource | typeof GLTF_SURFACE;

/**
 * Resolve every texture slot of one StandardMaterial3D, from gated references through
 * loads, precedence and binding to the eight three maps. Each reference resolves in
 * `tables`, the material's own file, whichever file that is. A triplanar material tiles
 * per world unit, so a PlaneMesh `surface` folds in its size. CSG and an ArrayMesh pass
 * nothing and get the material's own `uv1_scale`.
 */
export function useMaterialTextures(
  scalars: StandardMaterial3DScalars | null,
  tables: MaterialTables | null,
  surface?: TexturedSurface
): ResolvedMaterialTextures {
  const resourceTables = tables ?? NO_TABLES;

  // The decode's gated table, never the raw property bag: Godot declares and
  // samples a gated slot's sampler only inside its `if (features[…])` branch
  // (`scene/resources/material.cpp:1090,1745`), so a `normal_texture` without
  // `normal_enabled` reaches no shader at all.
  const references = scalars?.textureSlots;

  const slotTextures: Readonly<Record<TextureSlot, SlotTexture>> = {
    albedo_texture: useSlotTexture(references, resourceTables, 'albedo_texture'),
    normal_texture: useSlotTexture(references, resourceTables, 'normal_texture'),
    roughness_texture: useSlotTexture(references, resourceTables, 'roughness_texture'),
    metallic_texture: useSlotTexture(references, resourceTables, 'metallic_texture'),
    emission_texture: useSlotTexture(references, resourceTables, 'emission_texture'),
    ao_texture: useSlotTexture(references, resourceTables, 'ao_texture'),
    heightmap_texture: useSlotTexture(references, resourceTables, 'heightmap_texture'),
    anisotropy_flowmap: useSlotTexture(references, resourceTables, 'anisotropy_flowmap'),
  };
  // The per-material half of every binding: UV set and transform, sampler filter and
  // wrapping. The per-slot half (which slots decode sRGB, which sample UV2) is `bindSlotTexture`'s.
  const textureStates = useMemo(
    (): MaterialTextureStates | null => scalars && surfaceTextureStates(scalars, surface),
    [scalars, surface]
  );

  const albedoMap = useTransformedTexture(
    slotTextures.albedo_texture.texture,
    textureStates,
    'albedo_texture'
  );
  const normalMap = useTransformedTexture(
    slotTextures.normal_texture.texture,
    textureStates,
    'normal_texture'
  );
  const roughnessMap = useTransformedTexture(
    slotTextures.roughness_texture.texture,
    textureStates,
    'roughness_texture'
  );
  const metalnessMap = useTransformedTexture(
    slotTextures.metallic_texture.texture,
    textureStates,
    'metallic_texture'
  );
  const emissiveMap = useTransformedTexture(
    slotTextures.emission_texture.texture,
    textureStates,
    'emission_texture'
  );
  const aoMap = useTransformedTexture(slotTextures.ao_texture.texture, textureStates, 'ao_texture');
  const heightMap = useTransformedTexture(
    slotTextures.heightmap_texture.texture,
    textureStates,
    'heightmap_texture'
  );

  // Depend on the two values the repack reads, not their wrappers: a repack is a
  // canvas readback plus a full-buffer copy plus a GPU re-upload.
  const drawsAnisotropic = scalars !== null && isAnisotropic(scalars);
  const anisotropyFlowmap = slotTextures.anisotropy_flowmap.texture;
  const repackedFlowmap = useMemo(() => {
    if (!drawsAnisotropic || !anisotropyFlowmap) return undefined;
    return repackAnisotropyFlowmap(anisotropyFlowmap);
  }, [drawsAnisotropic, anisotropyFlowmap]);

  const anisotropyBound = useTransformedTexture(repackedFlowmap, textureStates, 'anisotropy_flowmap');

  // The binding may hand back a clone of the repack with its own upload. Only
  // the clone is a second object: when nothing diverged the two are one texture,
  // and the repack effect below owns it.
  const anisotropyClone = anisotropyBound === repackedFlowmap ? undefined : anisotropyBound;

  // One effect per texture: a shared dependency list runs every cleanup when any
  // slot resolves, freeing still-bound textures that three then re-uploads.
  useDisposeTexture(repackedFlowmap);
  useDisposeTexture(anisotropyClone);
  const albedoDrawn = useDrawnMap(albedoMap, slotTextures.albedo_texture.isArriving, 'albedo_texture');
  const normalDrawn = useDrawnMap(normalMap, slotTextures.normal_texture.isArriving, 'normal_texture');
  const roughnessDrawn = useDrawnMap(
    roughnessMap,
    slotTextures.roughness_texture.isArriving,
    'roughness_texture'
  );
  const metalnessDrawn = useDrawnMap(
    metalnessMap,
    slotTextures.metallic_texture.isArriving,
    'metallic_texture'
  );
  const emissiveDrawn = useDrawnMap(
    emissiveMap,
    slotTextures.emission_texture.isArriving,
    'emission_texture'
  );
  const aoDrawn = useDrawnMap(aoMap, slotTextures.ao_texture.isArriving, 'ao_texture');
  const heightDrawn = useDrawnMap(heightMap, slotTextures.heightmap_texture.isArriving, 'heightmap_texture');
  // Only an anisotropy-enabled material samples the flowmap, so only it waits for one.
  const anisotropyMap =
    anisotropyBound ??
    (drawsAnisotropic && slotTextures.anisotropy_flowmap.isArriving
      ? pendingMapStandIn('anisotropy_flowmap')
      : undefined);

  const isUnresolvable = TEXTURE_SLOTS.some(
    (slot) => slotTextures[slot].missing || slotTextures[slot].cyclic
  );

  const maps = useMemo(
    (): MaterialTextureMaps => ({
      albedoMap: albedoDrawn,
      normalMap: normalDrawn,
      roughnessMap: roughnessDrawn,
      metalnessMap: metalnessDrawn,
      emissiveMap: emissiveDrawn,
      aoMap: aoDrawn,
      heightMap: heightDrawn,
      anisotropyMap,
      albedoTargetUv: albedoDrawn?.isRenderTargetTexture ? textureStates?.uv1.uv : undefined,
    }),
    [
      textureStates,
      albedoDrawn,
      normalDrawn,
      roughnessDrawn,
      metalnessDrawn,
      emissiveDrawn,
      aoDrawn,
      heightDrawn,
      anisotropyMap,
    ]
  );

  return { maps, isUnresolved: isUnresolvable };
}

interface SurfaceMaterialSlotProps {
  /** The material this surface renders with; undefined = the renderer's default. */
  source: MaterialSource | undefined;
  /** R3F attach key: `material` for a single surface, `material-N` for many (`surfaceAttach`). */
  attach?: string;
  /** The mesh sub-resource a triplanar material folds into its tiling, if any. */
  triplanarMesh?: TscnInternalResource;
}

/**
 * One surface's material slot, textures and all, whichever file the material came from.
 * A surface with no usable material draws Godot's default one, which
 * `<StandardMaterialSlot>` builds from null scalars (ADR-0041). A surface whose texture
 * cannot load, or whose ViewportTexture albedo is cyclic, draws the magenta placeholder.
 */
export function SurfaceMaterialSlot({ source, attach, triplanarMesh }: SurfaceMaterialSlotProps) {
  const material = readyMaterial(useMaterial(source));
  const scalars = useMaterialScalars(material);
  const { maps, isUnresolved } = useMaterialTextures(scalars, material, triplanarMesh);
  if (isUnresolved) return materialBagElement(MISSING_TEXTURE_MATERIAL, attach, null);
  return <StandardMaterialSlot scalars={scalars} attach={attach} {...maps} />;
}

/** The decoded scalars of `material`, or null for Godot's default surface. */
export function useMaterialScalars(material: MaterialResource | null): StandardMaterial3DScalars | null {
  const resource = material?.resource;
  return useMemo(() => (resource ? parseStandardMaterial3DScalars(resource.data) : null), [resource]);
}

interface SlotTexture extends Texture2DResult {
  /** The slot names a ViewportTexture whose target sits in a pass cycle, so it is never written. */
  cyclic: boolean;
}

/**
 * One slot's texture, through every form a Texture2D slot takes, null while it arrives. A material
 * binds a texture by its RID: an AtlasTexture's RID is its whole sheet
 * (`scene/resources/atlas_texture.cpp:55-58`), a CanvasTexture's names no texture, and a
 * ViewportTexture's names its viewport's target, which arrives through the live registry.
 */
function useSlotTexture(
  references: TextureSlotReferences | undefined,
  { externalResources, internalResources }: MaterialTables,
  slot: TextureSlot
): SlotTexture {
  const ref = textureSlotReference(references, slot);
  const isViewport = isViewportTextureRef(ref, internalResources);
  const view = slotReadsSourceColor(slot) ? 'decoding' : 'plain';
  const viewport = useViewportTextureSlot(isViewport ? ref : undefined, internalResources, view);
  const result = useTexture2DRid(isViewport ? undefined : ref, externalResources, internalResources);
  if (isViewport)
    return { texture: viewport.texture, missing: false, isArriving: false, cyclic: viewport.cyclic };
  const texture = result.namesTexture ? result.texture : defaultWhiteTexture();
  return { texture, missing: result.missing, isArriving: result.isArriving, cyclic: false };
}

function textureSlotReference(
  references: TextureSlotReferences | undefined,
  slot: TextureSlot
): string | undefined {
  const raw = references?.[slot];
  return typeof raw === 'string' ? raw : undefined;
}

/**
 * The slot's texture with the material's own texture state applied. Undefined while nothing is
 * loaded, so the slot falls back to null.
 */
function useTransformedTexture(
  texture: THREE.Texture | null | undefined,
  states: MaterialTextureStates | null,
  slot: TextureSlot
): THREE.Texture | undefined {
  return useMemo(() => transformedTexture(texture, states, slot), [texture, states, slot]);
}

function transformedTexture(
  texture: THREE.Texture | null | undefined,
  states: MaterialTextureStates | null,
  slot: TextureSlot
): THREE.Texture | undefined {
  if (!texture) return undefined;
  // White samples the same under any wrap, filter, UV transform or colour space, so a clone buys nothing.
  if (!states || texture === defaultWhiteTexture()) return texture;
  return bindSlotTexture(texture, slot, states);
}

/** The texture states of `scalars` on `surface`. */
function surfaceTextureStates(
  scalars: StandardMaterial3DScalars,
  surface: TexturedSurface | undefined
): MaterialTextureStates {
  const states = materialTextureStates(scalars);
  if (surface === GLTF_SURFACE) return { ...states, uv1: onGltfUvs(states.uv1), uv2: onGltfUvs(states.uv2) };
  if (!surface) return states;
  return {
    ...states,
    uv1: scalars.triplanar ? planeTiled(states.uv1, surface) : states.uv1,
    uv2: scalars.uv2Triplanar ? planeTiled(states.uv2, surface) : states.uv2,
  };
}

/**
 * A state on a glTF surface. Its first UV set keeps Godot's top-down V, so a state that reads it
 * flips. A state that reads UV2 flips already, in `materialTextureStates`.
 */
function onGltfUvs(state: UVSetState): UVSetState {
  return state.channel === UV2_CHANNEL ? state : topDownV(state);
}

/**
 * A triplanar state tiled to the mesh's size. PARITY LIMITATION (offset + world-triplanar):
 * three applies `offset` in UV space, Godot's world-triplanar offset is in world units.
 */
function planeTiled(state: UVSetState, mesh: TscnInternalResource): UVSetState {
  return { ...state, uv: { scale: triplanarPlaneScale(mesh, state.uv.scale), offset: state.uv.offset } };
}

/**
 * The map a slot draws once it is on the GPU: a large one uploads in bands, and the slot keeps the
 * map it had meanwhile. With none yet, a stand-in fills the slot while a map uploads or arrives
 * (`pendingMapStandIn.ts` says why). The upload releases each map the slot stops drawing.
 */
function useDrawnMap(
  bound: THREE.Texture | undefined,
  isArriving: boolean,
  slot: TextureSlot
): THREE.Texture | undefined {
  const drawn = useTiledUpload(bound ?? null, releaseBoundTexture) ?? undefined;
  if (drawn) return drawn;
  return bound || isArriving ? pendingMapStandIn(slot) : undefined;
}

/** Disposes a texture this module allocated itself, which no binding releases, once it is replaced or the slot unmounts. */
function useDisposeTexture(texture: THREE.Texture | undefined): void {
  useEffect(() => {
    const own = texture;
    return () => own?.dispose();
  }, [texture]);
}
