/**
 * Resolve a Texture2D-valued property that references an `AtlasTexture` — a
 * sprite-sheet cell — into the cell as a texture of its own.
 *
 * Godot saves an AtlasTexture two ways, and both reach this module: inline as
 * a `[sub_resource]` in the file that uses it (`resolveAtlasTextureRef`), or
 * as its OWN standalone `.tres` — every Kenney input-prompt icon ships the
 * second way, one cell per file (`SubResourceResolver.resolveExtAtlasTexturePath`
 * finds the file; `decodeExtAtlasTextureRef` below decodes it once loaded).
 * Either decodes to the same `AtlasTextureReference` shape, so everything
 * below this point (the crop, the cache) is form-agnostic.
 *
 * Unlike a `GradientTexture2D`, an AtlasTexture is only HALF describable inside
 * the scene: the region is authored, the pixels come from the sheet the `atlas`
 * property names, which loads asynchronously through the resource pipeline.
 * So this takes the loaded sheet as an argument and declines until it arrives —
 * `proceduralTexture` does not cache a decline, so the next render retries.
 *
 * The crop is SHARED and owned by `proceduralTextureCache`: a sheet is cut into
 * cells precisely because many nodes point at them, and a canvas plus a GPU
 * upload per consumer is what the cache exists to avoid. Callers borrow it —
 * they must not dispose it, and must pin the key it comes with for as long as
 * they hold it. React consumers get both through `useTexture2D`.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import type { ParsedResource } from '../../../parser/parsedResource';
import { parseResourceReference, findSubResource } from '../../SubResourceResolver';
import { proceduralTexture, proceduralTextureKey } from '../proceduralTextureCache';
import { imageSize } from '../../../r3f/controls/withImageCanvas';
import { atlasTextureLayout, decodeAtlasTexture } from './decode';
import { rasterizeAtlasTexture } from './build';
import { ATLAS_TEXTURE_TYPE, type AtlasTextureData } from './types';

/** An AtlasTexture reference, inline or `.tres`: the id it resolves through (a sub-resource id or the file's own path), plus its decoded properties. */
export interface AtlasTextureReference {
  id: string;
  texture: AtlasTextureData;
}

/**
 * The AtlasTexture `ref` names, or null for every other reference form (an
 * `ExtResource` image, a `res://` path, a sub-resource of another type,
 * nothing at all) — leaving the caller's ordinary path untouched.
 */
export function resolveAtlasTextureRef(
  ref: string | undefined,
  internalResources: readonly TscnInternalResource[]
): AtlasTextureReference | null {
  const parsed = parseResourceReference(ref ?? '');
  if (!parsed || parsed.type !== 'SubResource') return null;
  const resource = findSubResource(internalResources, parsed.id);
  if (!resource || resource.type !== 'AtlasTexture') return null;
  return { id: parsed.id, texture: decodeAtlasTexture(resource.data as Record<string, unknown>) };
}

/**
 * The AtlasTexture reference a loaded `.tres` at `path` names, decoded into
 * the same shape `resolveAtlasTextureRef` produces for the inline form — or
 * null when the file's own header names something else (a hand-edited file
 * whose declared ext-resource `type=` no longer matches its content).
 */
export function decodeExtAtlasTextureRef(
  path: string,
  tres: ParsedResource
): AtlasTextureReference | null {
  if (tres.resourceType !== ATLAS_TEXTURE_TYPE) return null;
  return { id: path, texture: decodeAtlasTexture(tres.properties) };
}

/** A cropped cell and the procedural-cache key that keeps it resident. */
export interface AtlasTextureResolution {
  texture: THREE.Texture;
  /** Pinned for as long as a consumer holds `texture`. */
  key: string;
}

/**
 * `atlas`'s cell cut out of the loaded `sheet`, or null while the sheet has not
 * decoded, when the region describes nothing drawable, or where there is no
 * canvas to cut with.
 *
 * The cache entry is keyed by the sheet's identity as well as the
 * sub-resource's, so a reloaded sheet (a new `THREE.Texture` from the pipeline)
 * re-cuts rather than serving a crop of the superseded pixels.
 */
export function resolveAtlasTexture(
  atlas: AtlasTextureReference,
  sheet: THREE.Texture | null,
  internalResources: readonly TscnInternalResource[]
): AtlasTextureResolution | null {
  if (!sheet) return null;
  const layout = atlasTextureLayout(atlas.texture, imageSize(sheet.image) ?? null);
  if (!layout) return null;

  const cacheId = `${atlas.id}@${sheet.uuid}`;
  const texture = proceduralTexture(internalResources, cacheId, () =>
    rasterizeAtlasTexture(sheet.image, layout)
  );
  return texture ? { texture, key: proceduralTextureKey(internalResources, cacheId) } : null;
}
