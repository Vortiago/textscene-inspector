/**
 * What a padded atlas source draws from when its texture has no image of its own at load. Godot
 * builds the padded atlas once, from the texture's `get_image()` (`tile_set.cpp:5622-5654`). A
 * ViewportTexture it never set up gives no image, so the draw samples the empty texture's
 * placeholder. One it set up gives its target as it stands before the first render.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { isLiveTarget, unrenderedTexel } from './liveTargets';
import { useDisposeOnRelease } from './useDisposeOnRelease';
import { paddedAtlasSize } from '../resources/tileset/paddedAtlas';
import type { AtlasSourceModel } from '../resources/tileset/types';
import { textureSize } from '../resources/textures/textureSize';
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
    () => (isUnrenderedTarget && texture ? unrenderedSnapshot(texture, source) : null),
    [isUnrenderedTarget, texture, source]
  );
  useDisposeOnRelease(snapshot);
  if (isPadded && slot.hasNoImage) return unconfiguredViewportTexture();
  return snapshot;
}

/** The padded atlas Godot builds from `target`'s image before the target's first render. */
function unrenderedSnapshot(target: THREE.Texture, source: AtlasSourceModel): THREE.DataTexture {
  const size = paddedAtlasSize(source, textureSize(target) ?? { width: 0, height: 0 });
  const texel = unrenderedTexel(target);
  const data = new Uint8Array(size.x * size.y * 4);
  for (let offset = 0; offset < data.length; offset += 4) data.set(texel, offset);
  const snapshot = new THREE.DataTexture(data, size.x, size.y);
  snapshot.name = `${target.name}::unrendered`;
  snapshot.colorSpace = THREE.SRGBColorSpace;
  snapshot.needsUpdate = true;
  return snapshot;
}
