/**
 * Resolves a `NoiseTexture2D` sub-resource to a rasterised `THREE.DataTexture`,
 * synchronously: its own file describes it fully. `resolveProceduralSubResource`
 * owns the walk, the cache and the pin key. A 1024x1024 seamless field takes
 * about a second, so it rasterises once per scene and sub-resource.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { findSubResource, parseResourceReference } from '../../SubResourceResolver';
import { decodeFastNoiseLite } from '../../noise/fastnoiselite/decode';
import { resolveGradient } from '../gradienttexture2d/decode';
import {
  resolveProceduralSubResource,
  type ProceduralTextureResolution,
} from '../resolveProceduralSubResource';
import { rasterizeNoiseTexture2D } from './build';
import { decodeNoiseTexture2D } from './decode';

export function resolveNoiseTexture2D(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): ProceduralTextureResolution<THREE.DataTexture> | null {
  return resolveProceduralSubResource(ref, internalResources, 'NoiseTexture2D', rasterize);
}

/**
 * Texture properties and the table their `noise` and `color_ramp` refs resolve in,
 * to pixels. Null for an unusable `noise`, for which `_generate_texture` returns an
 * empty image (noise_texture_2d.cpp:159-161), and for a size `noiseTextureFits` refuses.
 */
function rasterize(
  properties: Record<string, string>,
  resources: readonly TscnInternalResource[]
): THREE.DataTexture | null {
  const decoded = decodeNoiseTexture2D(properties);
  const noiseResource = decoded.noise
    ? findSubResource(resources, parseResourceReference(decoded.noise)?.id ?? '')
    : undefined;
  // Only FastNoiseLite generates. Another Noise subclass would be its own slice
  // behind the same `noise` slot.
  if (!noiseResource || noiseResource.type !== 'FastNoiseLite') return null;

  const colorRamp = decoded.colorRamp ? resolveGradient(decoded.colorRamp, resources) : null;
  return rasterizeNoiseTexture2D(
    decoded,
    decodeFastNoiseLite(noiseResource.data as Record<string, string>),
    colorRamp
  );
}
