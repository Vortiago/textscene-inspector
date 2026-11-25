import { useMemo } from 'react';
import * as THREE from 'three';
import { readImagePixels } from '../../resources/formats/image/imagePixels';
import { paddedAtlasPixels } from '../../resources/tileset/paddedAtlas';
import type { AtlasSourceModel } from '../../resources/tileset/types';
import { reversedRows } from '../../utils/reversedRows';
import { useDisposeOnRelease } from '../useDisposeOnRelease';

/** The texture a source's tiles draw from: Godot's padded copy (`tile_set.cpp:5622`), or its own. */
export function useRuntimeAtlasTexture(
  texture: THREE.Texture | null,
  source: AtlasSourceModel
): THREE.Texture | null {
  const padded = useMemo(
    () => (texture && source.usesTexturePadding ? paddedAtlasTexture(texture, source) : null),
    [texture, source]
  );
  useDisposeOnRelease(padded);
  return source.usesTexturePadding ? padded : texture;
}

/** Null for a texture with no readable pixels, which Godot pads as an empty image. */
function paddedAtlasTexture(texture: THREE.Texture, source: AtlasSourceModel): THREE.Texture | null {
  const pixels = readImagePixels(texture.image);
  if (!pixels) return null;
  const { width, height } = pixels;
  const isBottomUp = Boolean((texture.image as { data?: unknown }).data) && !texture.flipY;
  const topDown = isBottomUp ? reversedRows(pixels.data, width, height) : pixels.data;
  const padded = paddedAtlasPixels({ data: topDown, width, height }, source);
  // Top row first, as a decoded image runs: Godot's UV v = 0 reads row 0.
  const atlas = new THREE.DataTexture(padded.data, padded.width, padded.height);
  atlas.colorSpace = texture.colorSpace;
  atlas.needsUpdate = true;
  return atlas;
}
