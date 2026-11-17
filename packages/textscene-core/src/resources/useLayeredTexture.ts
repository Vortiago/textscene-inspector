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

/**
 * The texture a layered slot reads, or null while it loads, for none, and for a form it cannot build.
 *
 * @canonical A layered texture slot's GPU texture
 */
export function useLayeredTexture<
  Source extends { form: string; path?: string },
  Built extends THREE.Texture,
>(reference: ScopedReference | null, slot: LayeredTextureSlot<Source, Built>): Built | null {
  const decoded = useReferencedResource(reference, slot.kind).value ?? null;
  const lookup = useMemo(() => slot.procedural(decoded), [slot, decoded]);
  const procedural = useProceduralTexture(lookup);
  const imagePath = decoded?.form === 'file' ? (decoded.path ?? null) : null;
  const loaded = useResource<Built>(imagePath ?? '', slot.busType);
  const texture = procedural.claimed ? procedural.texture : loaded.value;
  return slot.isBuilt(texture) ? texture : null;
}
