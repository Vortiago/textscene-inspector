/**
 * The pixels of Godot's decal atlas (`texture_storage.cpp:3156-3226`): each texture copied into its
 * rectangle over transparent black, and each next level the whole previous level halved.
 */

import { DECAL_ATLAS_MIPMAPS } from '../../../godot/rendering/decalAtlas.js';
import { mipChain, RGBA_BYTES, type MipLevel } from '../../../resources/processing/mipChain.js';
import type { GodotImage } from '../../../r3f/textureAtlas/godotImage.js';
import type { DecalAtlasLayout } from './decalAtlasLayout.js';

/** Copies `image` into `atlas` at `rect`'s corner, one row at a time. */
function copyInto(atlas: MipLevel, image: GodotImage, { x, y }: { x: number; y: number }): void {
  const rowBytes = image.width * RGBA_BYTES;
  for (let row = 0; row < image.height; row++) {
    atlas.data.set(
      image.data.subarray(row * rowBytes, (row + 1) * rowBytes),
      ((y + row) * atlas.width + x) * RGBA_BYTES
    );
  }
}

/**
 * The atlas's RGBA8 levels, largest first, each first row the top row. `images[i]` goes in
 * `layout.rects[i]`. Level n + 1 halves all of level n, so a small level blends neighbouring
 * textures and their padding as Godot's does (`:3220-3222`).
 */
export function decalAtlasLevels(layout: DecalAtlasLayout, images: readonly GodotImage[]): MipLevel[] {
  const base: MipLevel = {
    data: new Uint8Array(layout.width * layout.height * RGBA_BYTES),
    width: layout.width,
    height: layout.height,
  };
  images.forEach((image, index) => copyInto(base, image, layout.rects[index]!));
  return mipChain(base, false, DECAL_ATLAS_MIPMAPS);
}
