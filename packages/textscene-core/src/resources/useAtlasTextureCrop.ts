/**
 * The cell an AtlasTexture cuts from its loaded sheet, held while mounted. A loaded sheet's crop is
 * cache-owned and pinned, like a procedural texture, and a live target's is disposed on release.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import type { TscnInternalResource } from '../parser/types.js';
import {
  resolveAtlasTexture,
  type AtlasTextureReference,
} from './textures/atlastexture/resolveAtlasTexture.js';
import { useProceduralTexturePins } from './useProceduralTexture.js';
import { isLiveTarget } from '../r3f/liveTargets.js';
import { useDisposeOnRelease } from '../r3f/useDisposeOnRelease.js';

/**
 * Null while the sheet is loading or the region has no area. Keyed on the tables the atlas sits in,
 * so a re-parse invalidates it, and on whether the sheet is live, which picks the crop.
 */
export function useAtlasTextureCrop(
  atlas: AtlasTextureReference | null,
  sheet: THREE.Texture | null,
  atlasResources: readonly TscnInternalResource[]
): THREE.Texture | null {
  const isLiveSheet = sheet !== null && isLiveTarget(sheet);
  const cropped = useMemo(
    () => (atlas ? resolveAtlasTexture(atlas, sheet, atlasResources) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the resolver reads whether the sheet is live.
    [atlas, sheet, atlasResources, isLiveSheet]
  );
  useProceduralTexturePins(cropped?.key ? [cropped.key] : []);
  useDisposeOnRelease(cropped?.key === null ? cropped.texture : null);
  return cropped?.texture ?? null;
}
