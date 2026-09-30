/**
 * The one SubResource-to-cached-texture walk every procedural texture slice runs.
 * Each slice supplies its type name and rasteriser. The table is the owning
 * file's, so a material `.tres` passes its own `subResources` as a scene does.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../parser/types';
import { findSubResource, parseResourceReference } from '../SubResourceResolver';
import { proceduralTexture, proceduralTextureKey } from './proceduralTextureCache';
import { unlessAllocationFails } from './pixelAllocation';

/**
 * A rasterised procedural texture and the cache key that keeps it resident. They
 * travel together: an unpinned texture is free for eviction to dispose.
 */
export interface ProceduralTextureResolution<T extends THREE.Texture = THREE.Texture> {
  texture: T;
  /** Pinned for as long as a consumer holds `texture`. */
  key: string;
}

/**
 * Resolves `ref` as an inline `[sub_resource]` of `typeName`, rasterised once per
 * file and sub-resource. Null for every other reference form, which leaves the
 * caller's async path untouched, and for pixels the tab cannot allocate: a
 * GradientTexture2D at Godot's 16384² ceiling is 1 GiB of RGBA8. The result is
 * borrowed: never dispose it.
 */
export function resolveProceduralSubResource<T extends THREE.Texture>(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[],
  typeName: string,
  rasterize: (
    properties: Record<string, string>,
    resources: readonly TscnInternalResource[]
  ) => T | null
): ProceduralTextureResolution<T> | null {
  const resource = findTypedSubResource(ref, internalResources, typeName);
  if (!resource) return null;

  // The cache holds plain THREE.Texture, but a given sub-resource id has one
  // type, so whatever it holds under this key came out of this same rasterize.
  const texture = proceduralTexture(internalResources, resource.id, () =>
    unlessAllocationFails(allocationLabel(typeName, resource.id), () =>
      rasterize(resource.data as Record<string, string>, internalResources)
    )
  ) as T | null;
  if (!texture) return null;

  return { texture, key: proceduralTextureKey(internalResources, resource.id) };
}

/** The inline `[sub_resource]` of `typeName` that `ref` names. Null for every other reference form. */
export function findTypedSubResource(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[],
  typeName: string
): TscnInternalResource | null {
  const parsed = parseResourceReference(ref ?? '');
  if (!parsed || parsed.type !== 'SubResource') return null;
  const resource = findSubResource(internalResources, parsed.id);
  return resource?.type === typeName ? resource : null;
}

/** How an allocation failure names the sub-resource it could not build. */
export function allocationLabel(typeName: string, id: string): string {
  return `[${typeName}] sub-resource "${id}"`;
}
