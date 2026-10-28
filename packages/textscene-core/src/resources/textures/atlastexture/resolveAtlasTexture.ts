/**
 * Resolves a Texture2D property that names an `AtlasTexture` into the cell as its own texture. An
 * AtlasTexture in a resource file reads as a sub-resource of the file's own tables (`useParsedResourceSlot`), so
 * the inline and saved forms share one lookup, crop and cache.
 */

import type * as THREE from 'three';
import type { TscnInternalResource } from '../../../parser/types';
import { parseResourceReference, findSubResource } from '../../SubResourceResolver';
import { proceduralTexture, proceduralTextureKey } from '../proceduralTextureCache';
import { imageSize } from '../../formats/image/imagePixels';
import { atlasTextureLayout, decodeAtlasTexture } from './decode';
import { rasterizeAtlasTexture } from './build';
import { isLiveTarget, liveTargetCrop } from '../../../r3f/liveTargets';
import { pinColorSpace } from '../textureView';
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
 * A cropped cell, shared between the readers that cut it alike: a caller never disposes it. A cell
 * of a loaded sheet stays while a reader pins `key`, and a cell of a live target while a reader
 * holds `texture` (`holdUntilReleased`), where `key` is null. `useTexture2D` does both.
 */
interface AtlasTextureResolution {
  texture: THREE.Texture;
  key: string | null;
}

/**
 * `atlas`'s cell cut out of `sheet`, or null: an undecoded sheet, an empty region, or no canvas. A
 * loaded sheet is cut once, and `proceduralTexture` does not cache a null, so the next render
 * retries. The key includes the sheet's identity, so a reloaded sheet re-cuts. A live target is
 * cut after each of its renders, as Godot's AtlasTexture draws from the live RID.
 */
export function resolveAtlasTexture(
  atlas: AtlasTextureReference,
  sheet: THREE.Texture | null,
  internalResources: readonly TscnInternalResource[]
): AtlasTextureResolution | null {
  if (!sheet) return null;
  const layout = atlasTextureLayout(atlas.texture, imageSize(sheet.image) ?? null);
  if (!layout) return null;
  if (isLiveTarget(sheet)) {
    // Pinned, as the sheet is: R3F reasserts `SRGBColorSpace` on a `map` every commit.
    const crop = pinColorSpace(liveTargetCrop(sheet, layout), sheet.colorSpace as THREE.ColorSpace);
    return { texture: crop, key: null };
  }

  const cacheId = `${atlas.id}@${sheet.uuid}`;
  const texture = proceduralTexture(internalResources, cacheId, () => rasterizeAtlasTexture(sheet, layout));
  return texture ? { texture, key: proceduralTextureKey(internalResources, cacheId) } : null;
}
