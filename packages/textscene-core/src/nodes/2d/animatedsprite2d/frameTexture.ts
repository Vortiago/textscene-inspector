/**
 * Resolves a SpriteFrames frame's `texture` ref into a concrete source-image
 * path plus an optional atlas sub-region. A frame texture comes in two shapes:
 *
 *   - `ExtResource("id")` / raw `res://…` — a standalone Texture2D; resolves to
 *     a path with no region (the whole image is the frame).
 *   - `SubResource("AtlasTexture_…")` — the common sprite-sheet packing: an
 *     AtlasTexture with `atlas = ExtResource("id")` (the sheet) + `region =
 *     Rect2(x, y, w, h)` (the cell). Resolves to the atlas path + that region.
 *
 * Pools are passed in so this works for both SpriteFrames homes: a scene's own
 * SubResources/ExtResources, or those of an external `.tres` SpriteFrames file.
 */

import type { TscnExternalResource, TscnInternalResource } from '../../../parser/types';
import {
  findSubResource,
  parseResourceReference,
  resolveExtResourcePath,
} from '../../../resources/SubResourceResolver';

/** An AtlasTexture sub-region, in atlas pixels (top-left origin, like Godot). */
export interface FrameTextureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResolvedFrameTexture {
  /** `res://` path of the source image — the atlas for AtlasTexture frames, else the frame texture. `null` when unresolvable. */
  path: string | null;
  /** AtlasTexture sub-region to window the source image to; absent for whole-image frames. */
  region?: FrameTextureRegion;
}

export function resolveFrameTexture(
  ref: string | null | undefined,
  subResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): ResolvedFrameTexture {
  if (!ref) return { path: null };

  const parsed = parseResourceReference(ref);
  if (!parsed) {
    // Raw `res://` path passes through; anything else is unresolvable.
    return { path: ref.startsWith('res://') ? ref : null };
  }

  if (parsed.type === 'ExtResource') {
    return { path: resolveExtResourcePath(ref, externalResources) };
  }

  // SubResource — an AtlasTexture (atlas sheet + region) is the form SpriteFrames
  // use when packing frames into a single image. Other SubResource texture types
  // aren't sampled here (they have no file-backed source the pipeline can load).
  const sub = findSubResource(subResources, parsed.id);
  if (!sub || sub.type !== 'AtlasTexture') return { path: null };

  const atlasRef = typeof sub.data.atlas === 'string' ? sub.data.atlas : null;
  const path = resolveExtResourcePath(atlasRef, externalResources);
  const region = parseRect2(typeof sub.data.region === 'string' ? sub.data.region : undefined);
  return region ? { path, region } : { path };
}

const RECT2_RE =
  /^Rect2\(\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*\)$/;

function parseRect2(value: string | undefined): FrameTextureRegion | null {
  if (!value) return null;
  const m = RECT2_RE.exec(value);
  if (!m) return null;
  const x = parseFloat(m[1]!);
  const y = parseFloat(m[2]!);
  const width = parseFloat(m[3]!);
  const height = parseFloat(m[4]!);
  // A zero/negative-area region can't window anything — treat as no region.
  if (!(width > 0) || !(height > 0)) return null;
  return { x, y, width, height };
}
