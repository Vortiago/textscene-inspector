import { useMemo } from 'react';
import type * as THREE from 'three';
import { useReferencedResource, type ResourceKind, type ScopedReference } from './reading';
import type { ProceduralTextureLookup } from './textures/proceduralBuilds.js';
import { useProceduralTexture } from './useProceduralTexture.js';
import { useResource } from './useResource.js';
import type { ResourceBusType } from './sliceRegistration';

/** A layered texture class: its resource kind, its built forms, and the bus that imports its image. */
export interface LayeredTextureSlot<Source extends { form: string }, Built extends THREE.Texture> {
  readonly kind: ResourceKind<Source>;
  readonly procedural: (source: Source | null) => ProceduralTextureLookup | null;
  readonly busType: ResourceBusType;
  readonly isBuilt: (texture: unknown) => texture is Built;
}

/** A layered slot's texture, null while it loads, for none, and for a form it cannot build. */
export interface LayeredTextureState<Built extends THREE.Texture> {
  readonly texture: Built | null;
  /** True while the resource, its image file or its procedural build is on its way. */
  readonly isArriving: boolean;
  /** True when the slot never draws: the resource or its image file cannot load. */
  readonly isMissing: boolean;
}

/**
 * What a layered slot reads, and whether more is on its way or never will be.
 *
 * @canonical A layered texture slot's GPU texture
 */
export function useLayeredTextureState<
  Source extends { form: string; path?: string },
  Built extends THREE.Texture,
>(reference: ScopedReference | null, slot: LayeredTextureSlot<Source, Built>): LayeredTextureState<Built> {
  const read = useReferencedResource(reference, slot.kind);
  const decoded = read.value ?? null;
  const lookup = useMemo(() => slot.procedural(decoded), [slot, decoded]);
  const procedural = useProceduralTexture(lookup);
  const imagePath = decoded?.form === 'file' ? (decoded.path ?? null) : null;
  const loaded = useResource<Built>(imagePath ?? '', slot.busType);
  const texture = procedural.claimed ? procedural.texture : loaded.value;
  const isFileArriving = !procedural.claimed && imagePath !== null && loaded.status === 'pending';
  const isFileMissing = !procedural.claimed && imagePath !== null && loaded.status === 'unavailable';
  const built = slot.isBuilt(texture) ? texture : null;
  const isArriving =
    read.status === 'pending' || (procedural.claimed && procedural.building) || isFileArriving;
  const isMissing = read.status === 'unavailable' || isFileMissing;
  // Kept while its fields hold, so a consumer's effect on it runs only on a change.
  return useMemo(() => ({ texture: built, isArriving, isMissing }), [built, isArriving, isMissing]);
}

/** The texture a layered slot reads, or null while it loads, for none, and for a form it cannot build. */
export function useLayeredTexture<
  Source extends { form: string; path?: string },
  Built extends THREE.Texture,
>(reference: ScopedReference | null, slot: LayeredTextureSlot<Source, Built>): Built | null {
  return useLayeredTextureState(reference, slot).texture;
}
