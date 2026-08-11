/**
 * The one SubResource → cached-texture walk every procedural texture slice
 * runs: parse the reference, rasterise through `proceduralTextureCache` on
 * first request, and hand back the texture with the cache key a consumer must
 * pin. Each slice supplies only its type name and its rasteriser — the
 * reference grammar, the cache contract, and the type guard are stated once
 * here, so two slices cannot drift on how a procedural texture is keyed or
 * shared.
 *
 * The resource table a reference resolves in is the OWNING FILE's, which is
 * what lets a material `.tres` carry its own procedural textures: its
 * `albedo_texture = SubResource(...)` resolves by passing that file's
 * `subResources`, exactly as a scene passes its own.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../parser/types';
import { findSubResource, parseResourceReference } from '../SubResourceResolver';
import { proceduralTexture, proceduralTextureKey } from './proceduralTextureCache';

/**
 * A rasterised procedural texture and the cache key that keeps it resident.
 *
 * The two travel together because holding one without the other is the bug: a
 * consumer that samples the texture without pinning the key is sampling
 * something capacity eviction is free to dispose.
 */
export interface ProceduralTextureResolution<T extends THREE.Texture = THREE.Texture> {
  texture: T;
  /** Pinned for as long as a consumer holds `texture`. */
  key: string;
}

/**
 * Resolve `ref` as an inline `[sub_resource]` of `typeName`, rasterising once
 * per (file, sub-resource) through the shared cache. Null for every other
 * reference form (ExtResource, a `res://` path, a sub-resource of another
 * type), leaving the caller's async path untouched. The result is BORROWED —
 * never dispose it.
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
  const parsed = parseResourceReference(ref ?? '');
  if (!parsed || parsed.type !== 'SubResource') return null;

  // The cache holds plain THREE.Texture, but a given sub-resource id has one
  // type, so whatever it holds under this key came out of this same rasterize.
  const texture = proceduralTexture(internalResources, parsed.id, () => {
    const resource = findSubResource(internalResources, parsed.id);
    if (!resource || resource.type !== typeName) return null;
    return rasterize(resource.data as Record<string, string>, internalResources);
  }) as T | null;
  if (!texture) return null;

  return { texture, key: proceduralTextureKey(internalResources, parsed.id) };
}
