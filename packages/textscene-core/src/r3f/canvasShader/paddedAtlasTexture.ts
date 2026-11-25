import { useMemo } from 'react';
import * as THREE from 'three';
import { readImagePixels } from '../../resources/formats/image/imagePixels';
import { paddedAtlasPixels } from '../../resources/tileset/paddedAtlas';
import type { AtlasSourceModel } from '../../resources/tileset/types';
import { perObject } from '../../utils/perObject';
import { isBottomUp, reversedRows } from '../../utils/reversedRows';
import { useDisposeOnRelease } from '../useDisposeOnRelease';

/** Written only by `sharedAtlas`: each texture's padded copies by source, each dropped as it is disposed. */
const paddedCopiesOf = perObject(
  (_texture: THREE.Texture) => new Map<AtlasSourceModel, THREE.Texture | null>()
);

/** The texture a source's tiles draw from: Godot's padded copy (`tile_set.cpp:5622`), or its own. */
export function useRuntimeAtlasTexture(
  texture: THREE.Texture | null,
  source: AtlasSourceModel
): THREE.Texture | null {
  const padded = useMemo(
    () => (texture && source.usesTexturePadding ? sharedAtlas(texture, source) : null),
    [texture, source]
  );
  // Every run of the source holds the one copy, which its last holder disposes.
  useDisposeOnRelease(padded);
  return source.usesTexturePadding ? padded : texture;
}

/** The padded copy every run of `source` shares, made by the first. */
function sharedAtlas(texture: THREE.Texture, source: AtlasSourceModel): THREE.Texture | null {
  const copies = paddedCopiesOf(texture);
  if (copies.has(source)) return copies.get(source)!;
  const atlas = paddedAtlasTexture(texture, source);
  copies.set(source, atlas);
  atlas?.addEventListener('dispose', () => copies.delete(source));
  return atlas;
}

/** Null for a texture with no readable pixels, which Godot pads as an empty image. */
function paddedAtlasTexture(texture: THREE.Texture, source: AtlasSourceModel): THREE.Texture | null {
  const pixels = readImagePixels(texture.image);
  if (!pixels) return null;
  const { width, height } = pixels;
  const topDown = isBottomUp(texture) ? reversedRows(pixels.data, width, height) : pixels.data;
  const padded = paddedAtlasPixels({ data: topDown, width, height }, source);
  // Top row first, as a decoded image runs: Godot's UV v = 0 reads row 0.
  const atlas = new THREE.DataTexture(padded.data, padded.width, padded.height);
  atlas.colorSpace = texture.colorSpace;
  atlas.needsUpdate = true;
  return atlas;
}
