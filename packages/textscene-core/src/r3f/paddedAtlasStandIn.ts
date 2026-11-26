import { useMemo } from 'react';
import type * as THREE from 'three';
import { isLiveTarget, unrenderedTexel } from './liveTargets';
import { useDisposeOnRelease } from './useDisposeOnRelease';
import { perObject } from '../utils/perObject';
import type { AtlasSourceModel } from '../resources/tileset/types';
import { imageSize } from '../resources/formats/image/imagePixels';
import { paddedAtlasSize } from '../resources/tileset/paddedAtlas';
import { colourDataTexture } from '../resources/textures/colourDataTexture';
import { texture2DPlaceholder } from '../resources/textures/texture2DPlaceholder';
import type { Texture2DResult } from '../resources/useTexture2D';

/**
 * The stand-in `source` samples at its padded regions in place of `slot`'s texture, or null for a
 * texture the source samples itself. The caller never disposes the stand-in.
 */
export function usePaddedAtlasStandIn(
  slot: Pick<Texture2DResult, 'texture' | 'hasNoImage'>,
  source: AtlasSourceModel
): THREE.Texture | null {
  const { texture } = slot;
  const isPadded = source.usesTexturePadding && texture !== null;
  const isUnrenderedTarget = isPadded && isLiveTarget(texture);
  const snapshot = useMemo(
    () => (isUnrenderedTarget && texture ? sharedSnapshot(texture, source) : null),
    [isUnrenderedTarget, texture, source]
  );
  useDisposeOnRelease(snapshot);
  // Godot pads no image, so the draw samples the empty texture's placeholder (`tile_set.cpp:5626-5629`).
  if (isPadded && slot.hasNoImage) return texture2DPlaceholder();
  return snapshot;
}

/** Written only by `sharedSnapshot`: one stand-in per target and source, dropped when it is disposed. */
const snapshotsOf = perObject((_target: THREE.Texture) => new Map<AtlasSourceModel, THREE.DataTexture>());

/** Every run of a source shares the stand-in, which its last holder's release disposes. */
function sharedSnapshot(target: THREE.Texture, source: AtlasSourceModel): THREE.DataTexture {
  const snapshots = snapshotsOf(target);
  const held = snapshots.get(source);
  if (held) return held;
  const snapshot = unrenderedSnapshot(target, source);
  snapshot.addEventListener('dispose', () => {
    if (snapshots.get(source) === snapshot) snapshots.delete(source);
  });
  snapshots.set(source, snapshot);
  return snapshot;
}

/** The padded atlas Godot builds from `target`'s image before the target's first render. */
function unrenderedSnapshot(target: THREE.Texture, source: AtlasSourceModel): THREE.DataTexture {
  const padded = paddedAtlasSize(source, imageSize(target.image) ?? { width: 0, height: 0 });
  // One texel at least: a grid with no cell draws no tile, but GL holds no empty texture.
  const width = Math.max(padded.width, 1);
  const height = Math.max(padded.height, 1);
  const texels = new Uint8Array(width * height * 4);
  // One 32-bit fill, not a texel at a time: a padded atlas can hold a million texels.
  new Uint32Array(texels.buffer).fill(new Uint32Array(Uint8Array.from(unrenderedTexel(target)).buffer)[0]!);
  const snapshot = colourDataTexture(texels, width, height, 'RGBA8');
  // One colour reads the same either way up: marked top row first, the shader path turns no copy of it.
  snapshot.flipY = true;
  snapshot.name = `${target.name}::unrendered`;
  return snapshot;
}
