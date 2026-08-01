/**
 * Resolves a SpriteFrames frame's `texture` ref into a concrete source-image
 * path plus an optional atlas sub-region. A frame texture comes in two shapes:
 *
 *   - `ExtResource("id")` / raw `res://…` — a standalone Texture2D; resolves to
 *     a path with no region (the whole image is the frame).
 *   - `SubResource("AtlasTexture_…")` — the common sprite-sheet packing; the
 *     AtlasTexture slice decodes the section into atlas path + region.
 *
 * Pools are passed in so this works for both SpriteFrames homes: a scene's own
 * SubResources/ExtResources, or those of an external `.tres` SpriteFrames file.
 */

import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import {
  findSubResource,
  parseResourceReference,
  resolveExtResourcePath,
  type Texture2DSource,
} from '../../../resources/SubResourceResolver';
import { decodeAtlasTexture } from '../../../resources/textures/atlastexture/decode';
import { ATLAS_TEXTURE_TYPE } from '../../../resources/textures/atlastexture/types';

export function resolveFrameTexture(
  ref: string | null | undefined,
  subResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): Texture2DSource {
  if (!ref) return { path: null };

  const parsed = parseResourceReference(ref);
  if (!parsed) {
    // Raw `res://` path passes through; anything else is unresolvable.
    return { path: ref.startsWith('res://') ? ref : null };
  }

  if (parsed.type === 'ExtResource') {
    return { path: resolveExtResourcePath(ref, externalResources) };
  }

  // SubResource — an AtlasTexture is the form SpriteFrames use when packing
  // frames into a single image. Other SubResource texture types aren't sampled
  // here (they have no file-backed source the pipeline can load).
  const sub = findSubResource(subResources, parsed.id);
  if (!sub || sub.type !== ATLAS_TEXTURE_TYPE) return { path: null };
  const { atlas, region } = decodeAtlasTexture(sub.data);
  const path = atlas ? resolveExtResourcePath(atlas, externalResources) : null;
  return region ? { path, region } : { path };
}
