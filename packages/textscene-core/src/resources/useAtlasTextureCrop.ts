/**
 * The cell an AtlasTexture cuts from its loaded sheet, held while mounted. A loaded sheet's crop is
 * cache-owned and pinned, like a procedural texture, and a live target's is disposed on release.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import { resolveAtlasTexture } from './textures/atlastexture/resolveAtlasTexture.js';
import type { AtlasTextureData } from './textures/atlastexture/types.js';
import { useProceduralTexturePins } from './useProceduralTexture.js';
import { isLiveTarget } from '../r3f/liveTargets.js';
import { useDisposeOnRelease } from '../r3f/useDisposeOnRelease.js';

/**
 * Null while the sheet is loading or the region has no area. Keyed on the decoded atlas, which a
 * changed resource replaces, and on whether the sheet is live, which picks the crop.
 */
export function useAtlasTextureCrop(
  atlas: AtlasTextureData | null,
  sheet: THREE.Texture | null
): THREE.Texture | null {
  const isLiveSheet = sheet !== null && isLiveTarget(sheet);
  const cropped = useMemo(
    () => (atlas ? resolveAtlasTexture(atlas, sheet) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the resolver reads whether the sheet is live.
    [atlas, sheet, isLiveSheet]
  );
  useProceduralTexturePins(cropped?.key ? [cropped.key] : []);
  useDisposeOnRelease(cropped?.key === null ? cropped.texture : null);
  return cropped?.texture ?? null;
}
