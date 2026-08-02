/**
 * Resolve a `NoiseTexture2D` to a rasterised `THREE.DataTexture`, from either
 * arrival: a Texture2D-valued property naming an inline `[sub_resource]`, or a
 * standalone `.tres` whose `[resource]` body is the texture itself.
 *
 * Shaped exactly like `resolveGradientTexture2D`, and for the same reason: a
 * NoiseTexture2D is described entirely by the file it lives in (the texture
 * block plus the `FastNoiseLite` and `Gradient` blocks it references), so it
 * resolves synchronously where the texture slot is read, with no host-file round
 * trip. The resource table a reference resolves in is the OWNING FILE's, which
 * is what lets a material `.tres` carry its own procedural textures.
 *
 * The result is SHARED and owned by `proceduralTextureCache` — rasterising a
 * 1024x1024 seamless field costs on the order of a second, so doing it once per
 * (scene, sub-resource) rather than once per consumer is not just a memory
 * saving. Callers borrow: never dispose, and pin the key for as long as they
 * hold the texture. React consumers get both from `useProceduralTexture`.
 */

import type * as THREE from 'three';
import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';
import { findSubResource, parseResourceReference } from '../../SubResourceResolver';
import { decodeFastNoiseLite } from '../../noise/fastnoiselite/decode';
import { resolveGradient } from '../gradienttexture2d/decode';
import { proceduralTexture, proceduralTextureKey } from '../proceduralTextureCache';
import { rasterizeNoiseTexture2D } from './build';
import { decodeNoiseTexture2D } from './decode';

/** A rasterised noise texture and the procedural-cache key that keeps it resident. */
export interface NoiseTexture2DResolution {
  texture: THREE.DataTexture;
  /** Pinned for as long as a consumer holds `texture`. */
  key: string;
}

export function resolveNoiseTexture2D(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): NoiseTexture2DResolution | null {
  const parsed = parseResourceReference(ref ?? '');
  if (!parsed || parsed.type !== 'SubResource') return null;

  const texture = proceduralTexture(internalResources, parsed.id, () => {
    const textureResource = findSubResource(internalResources, parsed.id);
    if (!textureResource || textureResource.type !== 'NoiseTexture2D') return null;
    return rasterize(textureResource.data, internalResources);
  }) as THREE.DataTexture | null;
  if (!texture) return null;

  return { texture, key: proceduralTextureKey(internalResources, parsed.id) };
}

/**
 * The reserved cache id for a file whose `[resource]` body IS the texture —
 * the same bracketed id the gradient slice reserves, kept out of the
 * `<Type>_<suffix>` namespace Godot writes sub-resource ids in.
 */
const RESOURCE_BODY_ID = '[resource]';

/** The same rasterisation for a standalone `NoiseTexture2D.tres`. */
export function resolveNoiseTexture2DFromResource(
  parsed: ParsedResource
): NoiseTexture2DResolution | null {
  if (parsed.resourceType !== 'NoiseTexture2D') return null;

  const texture = proceduralTexture(parsed.subResources, RESOURCE_BODY_ID, () =>
    rasterize(parsed.properties, parsed.subResources)
  ) as THREE.DataTexture | null;
  if (!texture) return null;

  return { texture, key: proceduralTextureKey(parsed.subResources, RESOURCE_BODY_ID) };
}

/**
 * Texture properties plus the table their `noise` / `color_ramp` references
 * resolve in → pixels. Null when the `noise` reference names nothing usable:
 * Godot's `_generate_texture` returns an empty image for a null noise
 * (noise_texture_2d.cpp:159-161), so there is no texture to show either.
 */
function rasterize(
  properties: Record<string, unknown>,
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
  return rasterizeNoiseTexture2D(decoded, decodeFastNoiseLite(noiseResource.data), colorRamp);
}
