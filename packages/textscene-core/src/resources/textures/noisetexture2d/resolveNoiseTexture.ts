/**
 * Resolve a `NoiseTexture2D` reference — a Texture2D-valued property naming an
 * inline `[sub_resource]` — to a rasterised `THREE.DataTexture`.
 *
 * A NoiseTexture2D is described entirely by the file it lives in (the texture
 * block plus the `FastNoiseLite` and `Gradient` blocks it references), so it
 * resolves synchronously where the texture slot is read, with no host-file
 * round trip. The walk, the cache contract, and the pin-key story live in the
 * shared `resolveProceduralSubResource`; this file owns only what is
 * noise-specific — the rasterisation.
 *
 * The result is SHARED and owned by `proceduralTextureCache` — rasterising a
 * 1024x1024 seamless field costs on the order of a second, so doing it once per
 * (scene, sub-resource) rather than once per consumer is not just a memory
 * saving. Callers borrow: never dispose, and pin the key for as long as they
 * hold the texture. React consumers get both from `useProceduralTexture`.
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
 * Texture properties plus the table their `noise` / `color_ramp` references
 * resolve in → pixels. Null when the `noise` reference names nothing usable:
 * Godot's `_generate_texture` returns an empty image for a null noise
 * (noise_texture_2d.cpp:159-161), so there is no texture to show either.
 */
function rasterize(
  properties: Record<string, string>,
  resources: readonly TscnInternalResource[]
): THREE.DataTexture | null {
  const decoded = decodeNoiseTexture2D(properties);
  const noiseResource = decoded.noise
    ? findSubResource(resources, parseResourceReference(decoded.noise)?.id ?? '')
    : undefined;
  // Only FastNoiseLite is generated today; Godot's other Noise subclasses would
  // each be their own slice behind the same `noise` slot.
  if (!noiseResource || noiseResource.type !== 'FastNoiseLite') return null;

  const colorRamp = decoded.colorRamp ? resolveGradient(decoded.colorRamp, resources) : null;
  return rasterizeNoiseTexture2D(
    decoded,
    decodeFastNoiseLite(noiseResource.data as Record<string, string>),
    colorRamp
  );
}
