/**
 * Resolves a Texture2D property that names an `AtlasTexture` into the cell as its own texture. A
 * `.tres` AtlasTexture reads as a sub-resource of the file's own tables (`useParsedResourceSlot`), so
 * the inline and saved forms share one lookup, crop and cache.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { parseResourceReference, findSubResource } from '../../SubResourceResolver';
import { proceduralTexture, proceduralTextureKey } from '../proceduralTextureCache';
import { imageSize } from '../../formats/image/imagePixels';
import { atlasTextureLayout, decodeAtlasTexture } from './decode';
import { rasterizeAtlasTexture } from './build';
import type { AtlasTextureData } from './types';

/** An AtlasTexture reference: its sub-resource id and its decoded properties. */
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
  return { id: parsed.id, texture: decodeAtlasTexture(resource.data) };
}

/**
 * A cropped cell and the procedural-cache key that keeps it resident. The crop is
 * shared: a caller must not dispose it, and pins `key` while it holds `texture`.
 * `useTexture2D` does both for React consumers.
 */
interface AtlasTextureResolution {
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
  const texture = proceduralTexture(internalResources, cacheId, () => rasterizeAtlasTexture(sheet, layout));
  return texture ? { texture, key: proceduralTextureKey(internalResources, cacheId) } : null;
}
