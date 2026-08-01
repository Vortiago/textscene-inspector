/**
 * Resolve a `GradientTexture2D` to a rasterised `THREE.DataTexture`, from
 * either arrival: a Texture2D-valued property naming an inline
 * `[sub_resource]`, or a standalone `.tres` whose `[resource]` body is the
 * texture itself.
 *
 * Unlike an `ExtResource` image (a file loaded asynchronously through the
 * resource pipeline), a `GradientTexture2D` is fully described by the file it
 * lives in: the texture block plus the `Gradient` block it references. So it
 * resolves synchronously, right where the material's texture slots are read —
 * no `useResource`/host-file round trip once the file itself is in hand.
 * Returns `null` for any other reference form (ExtResource, a different
 * SubResource type, a missing gradient), leaving the caller's async path
 * untouched.
 *
 * The resource table a reference resolves in is the OWNING FILE's, which is
 * what lets a `.tres` carry its own procedural textures: a material `.tres`
 * whose `albedo_texture` is a `SubResource(GradientTexture2D)` resolves by
 * passing that file's `subResources`, exactly as a scene passes its own.
 *
 * The result is SHARED and owned by `proceduralTextureCache` — many nodes point
 * at one gradient, so it is rasterised once per (scene, sub-resource). Callers
 * borrow it: they must not dispose it, and must pin the key it comes with for
 * as long as they hold it. React consumers get both from `useProceduralTexture`
 * rather than calling this directly.
 */

import type { ParsedResource } from '../../../parser/parsedResource';
import type { TscnInternalResource } from '../../../parser/types';
import { findSubResource, parseResourceReference } from '../../SubResourceResolver';
import { decodeGradientTexture2D, resolveGradient } from './decode';
import { rasterizeGradientTexture2D } from './build';
import { proceduralTexture, proceduralTextureKey } from '../proceduralTextureCache';
import type * as THREE from 'three';

/**
 * A rasterised gradient and the procedural-cache key that keeps it resident.
 *
 * The two travel together because holding one without the other is the bug: a
 * consumer that samples the texture without pinning the key is sampling
 * something capacity eviction is free to dispose. Deriving the key separately
 * also let it be minted for references that resolve to no texture at all — a
 * key the cache never holds.
 */
export interface GradientTexture2DResolution {
  texture: THREE.DataTexture;
  /** Pinned for as long as a consumer holds `texture`. */
  key: string;
}

export function resolveGradientTexture2D(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): GradientTexture2DResolution | null {
  const parsed = parseResourceReference(ref ?? '');
  if (!parsed || parsed.type !== 'SubResource') return null;

  const texture = proceduralTexture(internalResources, parsed.id, () => {
    const textureResource = findSubResource(internalResources, parsed.id);
    if (!textureResource || textureResource.type !== 'GradientTexture2D') return null;
    return rasterize(textureResource.data as Record<string, string>, internalResources);
  }) as THREE.DataTexture | null;
  if (!texture) return null;

  return { texture, key: proceduralTextureKey(internalResources, parsed.id) };
}

/**
 * The reserved cache id for a file whose `[resource]` body IS the texture —
 * bracketed to keep it out of the `<Type>_<suffix>` / bare-integer namespace
 * Godot writes sub-resource ids in.
 */
const RESOURCE_BODY_ID = '[resource]';

/**
 * The same rasterisation for a standalone `GradientTexture2D.tres` — the
 * `[resource]` body is the texture, and its `gradient` names a `[sub_resource]`
 * of that same file, so the file's own resource table is the scope both the
 * lookup and the cache key run in.
 *
 * Null for a file of another type, and for a `gradient` that is an
 * `ExtResource` naming a separate `Gradient.tres` — that second file would have
 * to be fetched first, which this synchronous path cannot do; the caller's
 * async path keeps it.
 */
export function resolveGradientTexture2DFromResource(
  parsed: ParsedResource
): GradientTexture2DResolution | null {
  if (parsed.resourceType !== 'GradientTexture2D') return null;

  const texture = proceduralTexture(parsed.subResources, RESOURCE_BODY_ID, () =>
    rasterize(parsed.properties, parsed.subResources)
  ) as THREE.DataTexture | null;
  if (!texture) return null;

  return { texture, key: proceduralTextureKey(parsed.subResources, RESOURCE_BODY_ID) };
}

/**
 * Texture properties plus the table their `gradient` reference resolves in →
 * pixels. The one rasterisation both arrival paths run, so an inline
 * `[sub_resource]` and a standalone `.tres` cannot disagree.
 */
function rasterize(
  properties: Record<string, string>,
  resources: readonly TscnInternalResource[]
): THREE.DataTexture | null {
  const gradient = resolveGradient(properties.gradient, resources);
  if (!gradient) return null;
  return rasterizeGradientTexture2D(decodeGradientTexture2D(properties), gradient);
}
