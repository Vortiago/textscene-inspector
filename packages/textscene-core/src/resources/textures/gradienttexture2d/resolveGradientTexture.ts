/**
 * Resolve a `GradientTexture2D` reference — a Texture2D-valued property naming
 * an inline `[sub_resource]` — to a rasterised `THREE.DataTexture`.
 *
 * Unlike an `ExtResource` image (a file loaded asynchronously through the
 * resource pipeline), a `GradientTexture2D` is fully described by the file it
 * lives in: the texture block plus the `Gradient` block it references. So it
 * resolves synchronously, right where the material's texture slots are read —
 * no `useResource`/host-file round trip once the file itself is in hand. The
 * walk, the cache contract, and the pin-key story live in the shared
 * `resolveProceduralSubResource`; this file owns only what is
 * gradient-specific — the rasterisation.
 *
 * The result is SHARED and owned by `proceduralTextureCache` — many nodes point
 * at one gradient, so it is rasterised once per (scene, sub-resource). Callers
 * borrow it: they must not dispose it, and must pin the key it comes with for
 * as long as they hold it. React consumers get both from `useProceduralTexture`
 * rather than calling this directly.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import {
  resolveProceduralSubResource,
  type ProceduralTextureResolution,
} from '../resolveProceduralSubResource';
import { decodeGradientTexture2D, resolveGradient } from './decode';
import { rasterizeGradientTexture2D } from './build';

export function resolveGradientTexture2D(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): ProceduralTextureResolution<THREE.DataTexture> | null {
  return resolveProceduralSubResource(ref, internalResources, 'GradientTexture2D', rasterize);
}

/**
 * Texture properties plus the table their `gradient` reference resolves in →
 * pixels.
 */
function rasterize(
  properties: Record<string, string>,
  resources: readonly TscnInternalResource[]
): THREE.DataTexture | null {
  const gradient = resolveGradient(properties.gradient, resources);
  if (!gradient) return null;
  return rasterizeGradientTexture2D(decodeGradientTexture2D(properties), gradient);
}
