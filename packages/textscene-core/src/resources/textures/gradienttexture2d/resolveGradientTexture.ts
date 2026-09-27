/**
 * Resolves a `GradientTexture2D` sub-resource to a rasterised `THREE.DataTexture`,
 * synchronously: its own file describes it fully. `resolveProceduralSubResource`
 * owns the walk, the cache and the pin key. This owns the rasterisation, once per
 * scene and sub-resource. React consumers use `useProceduralTexture`.
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
 * Texture properties and the table their `gradient` reference resolves in, to pixels. Null with no
 * gradient.
 */
function rasterize(
  properties: Record<string, string>,
  resources: readonly TscnInternalResource[]
): THREE.DataTexture | null {
  const gradient = resolveGradient(properties.gradient, resources);
  if (!gradient) return null;
  return rasterizeGradientTexture2D(decodeGradientTexture2D(properties), gradient);
}
