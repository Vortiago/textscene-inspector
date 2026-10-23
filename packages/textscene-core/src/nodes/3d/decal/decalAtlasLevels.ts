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
 *
 * The buffers of `reusable`, the levels of the last build, are written over when the atlas keeps
 * its size, and the caller gives up that build. A rebuild at 2048 × 2048 took 70 ms with fresh
 * buffers and 15 ms with reused ones.
 */
export function decalAtlasLevels(
  layout: DecalAtlasLayout,
  images: readonly GodotImage[],
  reusable: readonly MipLevel[] = []
): MipLevel[] {
  const base = baseLevel(layout, reusable[0]);
  images.forEach((image, index) => copyInto(base, image, layout.rects[index]!));
  return mipChain(base, false, DECAL_ATLAS_MIPMAPS, reusable);
}

/** The atlas's transparent black base: `spare` cleared when it has the size, else new. */
function baseLevel({ width, height }: DecalAtlasLayout, spare: MipLevel | undefined): MipLevel {
  if (spare?.width === width && spare.height === height) {
    spare.data.fill(0);
    return spare;
  }
  return { data: new Uint8Array(width * height * RGBA_BYTES), width, height };
}
