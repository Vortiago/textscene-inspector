/**
 * Resolves a Texture2D property that names an `AtlasTexture` into the cell as its
 * own texture. Inline (`resolveAtlasTextureRef`) and `.tres`
 * (`SubResourceResolver.resolveExtAtlasTexturePath`, `decodeExtAtlasTextureRef`)
 * forms decode to one `AtlasTextureReference`, so the crop and cache are form-agnostic.
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

/** An AtlasTexture reference, inline or `.tres`: its id (a sub-resource id or the file's path) and decoded properties. */
export interface AtlasTextureReference {
  id: string;
  texture: AtlasTextureData;
}

/**
 * The AtlasTexture `ref` names, or null for every other reference form, which
 * leaves the caller's ordinary path untouched.
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
 * The AtlasTexture reference a loaded `.tres` at `path` names, in the inline
 * form's shape, or null when the file's header names another type.
 */
export function decodeExtAtlasTextureRef(
  path: string,
  tres: ParsedResource
): AtlasTextureReference | null {
  if (tres.resourceType !== ATLAS_TEXTURE_TYPE) return null;
  return { id: path, texture: decodeAtlasTexture(tres.properties) };
}

/**
 * A cropped cell and the procedural-cache key that keeps it resident. The crop is
 * shared: a caller must not dispose it, and pins `key` while it holds `texture`.
 * `useTexture2D` does both for React consumers.
 */
export interface AtlasTextureResolution {
  texture: THREE.Texture;
  /** Pinned for as long as a consumer holds `texture`. */
  key: string;
}

/**
 * `atlas`'s cell cut out of the loaded `sheet`, or null: an undecoded sheet, an
 * empty region, or no canvas. `proceduralTexture` does not cache a null, so the
 * next render retries. The key includes the sheet's identity, so a reloaded sheet re-cuts.
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
