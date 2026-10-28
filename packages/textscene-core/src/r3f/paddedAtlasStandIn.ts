/**
 * What a padded atlas source draws from when its texture has no image of its own at load. Godot
 * builds the padded atlas once, from the texture's `get_image()` (`tile_set.cpp:5622-5654`). A
 * ViewportTexture it never set up gives no image, so the draw samples the empty texture's
 * placeholder. One it set up gives its target as it stands before the first render, every texel
 * alike, so one texel stands in for the whole padded atlas.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import { isLiveTarget, unrenderedTexel } from './liveTargets';
import { useDisposeOnRelease } from './useDisposeOnRelease';
import type { AtlasSourceModel } from '../resources/tileset/types';
import { colourDataTexture } from '../resources/textures/colourDataTexture';
import { unconfiguredViewportTexture } from '../resources/textures/viewporttexture/unconfiguredViewportTexture';
import type { Texture2DResult } from '../resources/useTexture2D';

/**
 * The stand-in `source` samples at its padded regions in place of `slot`'s texture, or null for a
 * texture the source samples itself. The caller never disposes the stand-in.
 */
export function usePaddedAtlasStandIn(slot: Texture2DResult, source: AtlasSourceModel): THREE.Texture | null {
  const { texture } = slot;
  const isPadded = source.usesTexturePadding && texture !== null;
  const isUnrenderedTarget = isPadded && isLiveTarget(texture);
  const snapshot = useMemo(
    () => (isUnrenderedTarget && texture ? unrenderedSnapshot(texture) : null),
    [isUnrenderedTarget, texture]
  );
  useDisposeOnRelease(snapshot);
  if (isPadded && slot.hasNoImage) return unconfiguredViewportTexture();
  return snapshot;
}

/** The texel of the padded atlas Godot builds from `target`'s image before the target's first render. */
function unrenderedSnapshot(target: THREE.Texture): THREE.DataTexture {
  const snapshot = colourDataTexture(Uint8Array.from(unrenderedTexel(target)), 1, 1, 'RGBA8');
  snapshot.name = `${target.name}::unrendered`;
  return snapshot;
}
