/**
 * A surface's texture slots, every one through the same path: a gated reference loads, takes the
 * material's own texture state, and uploads in bands before it draws. The anisotropy flowmap takes
 * one extra step first, its repack. The result is keyed by Godot slot, which `materialBag.ts`
 * pairs with three's map names once.
 */

import type * as THREE from 'three';
import { useMemo } from 'react';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { useAnisotropicFilteringLevel } from '../contexts/AnisotropicFilteringContext';
import type { TscnInternalResource } from '../../parser/types';
import { useTexture2DRid, type Texture2DResult } from '../../resources/useTexture2D';
import { useTextureView } from '../useTextureView';
import type {
  ResolvedTextures,
  StandardMaterial3DScalars,
  TextureSlot,
  TextureSlotReferences,
} from '../../resources/materials/standardmaterial3d/types';
import { TEXTURE_SLOTS } from '../../resources/materials/standardmaterial3d/types';
import { isAnisotropic } from '../../resources/materials/standardmaterial3d/materialBag';
import {
  materialTextureStates,
  slotReadsSourceColor,
  slotViewSampler,
  topDownV,
  fromTopEdge,
  type MaterialTextureStates,
  type UVSetState,
} from '../../resources/materials/standardmaterial3d/textureBinding';
import { UV2_CHANNEL } from '../../resources/meshes/uv2';
import { repackAnisotropyFlowmap } from '../../resources/textures/repackFlowmap';
import { triplanarPlaneScale } from '../../nodes/3d/meshinstance3d/triplanarScale';
import { defaultWhiteTexture } from './defaultWhiteTexture';
import { pendingMapStandIn } from './pendingMapStandIn';
import type { MaterialResource } from './materialSource';

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
 * Every texture slot of one StandardMaterial3D, resolved in `tables`, the material's own file. A
 * triplanar material tiles per world unit: a PlaneMesh `surface` folds in its size, and CSG or an
 * ArrayMesh passes none and gets `uv1_scale`. Null when a slot never draws, a file that cannot load
 * or a ViewportTexture in a pass cycle: the surface takes `MISSING_TEXTURE_MATERIAL`.
 */
export function useSurfaceTextures(
  scalars: StandardMaterial3DScalars | null,
  tables: MaterialTables | null,
  surface?: TexturedSurface
): ResolvedTextures | null {
  const resourceTables = tables ?? NO_TABLES;

  // The decode's gated table, never the raw property bag: Godot samples a gated slot only inside
  // its `if (features[…])` branch (`scene/resources/material.cpp:1090,1745`), so a
  // `normal_texture` without `normal_enabled` reaches no shader.
  const references = scalars?.textureSlots;

  const sources = useEachSlot(useSlotTexture, references, resourceTables);
  // The per-material half of every binding: UV set and transform, sampler filter and
  // wrapping. The per-slot half (which slots decode sRGB, which sample UV2) is `slotViewSampler`'s.
  const anisotropicFilteringLevel = useAnisotropicFilteringLevel();
  const states = useMemo(
    (): MaterialTextureStates | null =>
      scalars && surfaceTextureStates(scalars, surface, anisotropicFilteringLevel),
    [scalars, surface, anisotropicFilteringLevel]
  );

  const flowmap = useRepackedFlowmap(sources.anisotropy_flowmap, scalars !== null && isAnisotropic(scalars));
  const drawn = useEachSlot(useDrawnSlot, { ...sources, anisotropy_flowmap: flowmap }, states);

  const maps = TEXTURE_SLOTS.map((slot) => drawn[slot]);
  const textures = useMemo(
    (): ResolvedTextures => ({ ...drawn }),
    // `maps` has one entry per slot, a fixed length, and stands for `drawn`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    maps
  );

  const isUnresolved = TEXTURE_SLOTS.some((slot) => sources[slot].missing);
  return isUnresolved ? null : textures;
}

/**
 * `useSlot(slot, ...args)` for each texture slot, in `TEXTURE_SLOTS` order, keyed by slot. The
 * loop answers `react-hooks/rules-of-hooks`: `TEXTURE_SLOTS` is a constant, so every render calls
 * the same hooks in the same order.
 */
function useEachSlot<Args extends unknown[], T>(
  useSlot: (slot: TextureSlot, ...args: Args) => T,
  ...args: Args
): Readonly<Record<TextureSlot, T>> {
  const results: Partial<Record<TextureSlot, T>> = {};
  for (const slot of TEXTURE_SLOTS) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- `TEXTURE_SLOTS` is a constant.
    results[slot] = useSlot(slot, ...args);
  }
  return results as Record<TextureSlot, T>;
}

/** What a slot draws from: its texture, null while it arrives, and whether one is on its way. */
type SlotMap = Pick<Texture2DResult, 'texture' | 'isArriving'>;

/**
 * One slot's texture in every form a Texture2D slot takes, null while it arrives. A material binds
 * a texture by RID: an AtlasTexture's is its whole sheet (`scene/resources/atlas_texture.cpp:55-58`),
 * a CanvasTexture's names none, and a ViewportTexture's names its viewport's target.
 */
function useSlotTexture(
  slot: TextureSlot,
  references: TextureSlotReferences | undefined,
  { externalResources, internalResources }: MaterialTables
): Texture2DResult {
  const view = slotReadsSourceColor(slot) ? 'decoding' : 'plain';
  const result = useTexture2DRid(
    textureSlotReference(references, slot),
    externalResources,
    internalResources,
    view
  );
  return result.namesTexture ? result : { ...result, texture: defaultWhiteTexture() };
}

function textureSlotReference(
  references: TextureSlotReferences | undefined,
  slot: TextureSlot
): string | undefined {
  const raw = references?.[slot];
  return typeof raw === 'string' ? raw : undefined;
}

/**
 * The flowmap as three reads it: its strength moved into blue. Only an anisotropic material
 * samples it, so only that one repacks (a canvas readback, a buffer copy and a GPU re-upload) and
 * waits for an arriving map. The memo depends on the two values the repack reads, not their wrapper.
 */
function useRepackedFlowmap(flowmap: SlotMap, isSampled: boolean): SlotMap {
  const { texture } = flowmap;
  const repacked = useMemo(
    () => (isSampled && texture ? repackAnisotropyFlowmap(texture) : undefined),
    [isSampled, texture]
  );
  // This module allocated the repack, and no binding releases it.
  useDisposeOnRelease(repacked);
  return { texture: repacked ?? null, isArriving: flowmap.isArriving && isSampled };
}

/**
 * The map a slot draws: its texture as the material's texture state samples it, once on the GPU. A
 * large map uploads in bands and the slot keeps its old map meanwhile. With none, a stand-in fills
 * the slot while a map uploads or arrives (`pendingMapStandIn.ts`).
 */
function useDrawnSlot(
  slot: TextureSlot,
  maps: Readonly<Record<TextureSlot, SlotMap>>,
  states: MaterialTextureStates | null
): THREE.Texture | undefined {
  const { texture, isArriving } = maps[slot];
  // White samples the same under any wrap, filter, window or colour space, so a clone buys nothing.
  const isSampledAsIs = !texture || !states || texture === defaultWhiteTexture();
  const drawn = useTextureView(texture, isSampledAsIs ? null : slotViewSampler(texture, slot, states));
  if (drawn) return drawn;
  return texture || isArriving ? pendingMapStandIn(slot) : undefined;
}

/** The texture states of `scalars` on `surface`. */
function surfaceTextureStates(
  scalars: StandardMaterial3DScalars,
  surface: TexturedSurface | undefined,
  anisotropicFilteringLevel: number
): MaterialTextureStates {
  const states = materialTextureStates(scalars, anisotropicFilteringLevel);
  if (surface === GLTF_SURFACE) return { ...states, uv1: onGltfUvs(states.uv1), uv2: onGltfUvs(states.uv2) };
  if (scalars.triplanar)
    return {
      ...states,
      uv1: surface ? planeTiled(states.uv1, surface) : states.uv1,
      uv2: surface && scalars.uv2Triplanar ? planeTiled(states.uv2, surface) : states.uv2,
    };
  return {
    ...states,
    uv1: fromTopEdge(states.uv1),
    uv2: surface && scalars.uv2Triplanar ? planeTiled(states.uv2, surface) : states.uv2,
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
  return { ...state, uv: { repeat: triplanarPlaneScale(mesh, state.uv.repeat), offset: state.uv.offset } };
}
