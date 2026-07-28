/**
 * Resolve a Texture2D-valued property that references an inline
 * `GradientTexture2D` sub-resource to a rasterised `THREE.DataTexture`.
 *
 * Unlike an `ExtResource` texture (an image file loaded asynchronously through
 * the resource pipeline), a `GradientTexture2D` is fully described inside the
 * scene: the texture block plus the `Gradient` block it references. So it
 * resolves synchronously, right where the material's texture slots are read —
 * no `useResource`/host-file round trip. Returns `null` for any other reference
 * form (ExtResource, a different SubResource type, a missing gradient), leaving
 * the caller's async path untouched.
 *
 * The result is SHARED and owned by `proceduralTextureCache` — many nodes point
 * at one gradient, so it is rasterised once per (scene, sub-resource). Callers
 * borrow it and must not dispose it.
 */

import type { TscnInternalResource } from '../../../parser/types';
import {
  findSubResource,
  parseResourceReference,
  resolveSubResourceRef,
} from '../../SubResourceResolver';
import { parseGradient, parseGradientTexture2D } from './parser';
import { rasterizeGradientTexture2D } from './renderer';
import { proceduralTexture, proceduralTextureKey } from '../proceduralTextureCache';
import type * as THREE from 'three';

/**
 * The cache key backing `resolveGradientTexture2D(ref, …)`, or null when the
 * reference is not a sub-resource. A mounted consumer pins this so capacity
 * eviction cannot dispose a texture it is still sampling.
 */
export function gradientTextureCacheKey(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): string | null {
  const parsed = parseResourceReference(ref ?? '');
  if (!parsed || parsed.type !== 'SubResource') return null;
  return proceduralTextureKey(internalResources, parsed.id);
}

export function resolveGradientTexture2D(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): THREE.DataTexture | null {
  const parsed = parseResourceReference(ref ?? '');
  if (!parsed || parsed.type !== 'SubResource') return null;

  return proceduralTexture(internalResources, parsed.id, () => {
    const textureResource = findSubResource(internalResources, parsed.id);
    if (!textureResource || textureResource.type !== 'GradientTexture2D') return null;

    const data = textureResource.data as Record<string, string>;
    const gradientResource = resolveSubResourceRef(data.gradient, internalResources);
    if (!gradientResource || gradientResource.type !== 'Gradient') return null;

    const texture = parseGradientTexture2D(data);
    const gradient = parseGradient(gradientResource.data as Record<string, string>);
    return rasterizeGradientTexture2D(texture, gradient);
  }) as THREE.DataTexture | null;
}
