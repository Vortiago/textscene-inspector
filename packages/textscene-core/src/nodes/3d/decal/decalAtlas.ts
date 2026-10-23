/**
 * The one decal atlas every Decal samples its albedo from, as Godot keeps one for every viewport
 * (`texture_storage.cpp:3038-3258`). Each Decal holds its `texture_albedo` while it projects it,
 * and a Decal rebuilds the atlas before a render when a texture joined it or changed its pixels.
 * `decalAtlasLayout.ts` lays it out and `decalAtlasLevels.ts` fills its levels.
 */

import * as THREE from 'three';
import { releasedOnUnmount } from '../../../r3f/sharedTexture.js';
import { AtlasHolders } from '../../../r3f/textureAtlas/atlasHolders.js';
import { AtlasTexture, holdAtlasLevels } from '../../../r3f/textureAtlas/atlasTexture.js';
import { readableTextures } from '../../../r3f/textureAtlas/godotImage.js';
import { fitDecalAtlas, packDecalAtlas, type DecalAtlasLayout } from './decalAtlasLayout.js';
import { decalAtlasLevels } from './decalAtlasLevels.js';

/** Where a texture lies in the atlas: left, top, width and height as fractions of it, top row first. */
export interface DecalAtlasRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Sampled through the sRGB view of an RGBA8 texture (`render_forward_clustered.cpp:3213`). */
const atlasTexture = releasedOnUnmount(new AtlasTexture('DecalAtlas', THREE.SRGBColorSpace));

/** Each held texture, as Godot's map keeps them. */
const holders = new AtlasHolders();

/**
 * Where the last build placed each held texture it could read and fit. Written by
 * `updateDecalAtlas`, and cleared of a texture the moment its last holder lets go.
 */
let rects = new Map<THREE.Texture, DecalAtlasRect>();

/** Whether the last build left a readable texture out for the GPU's size. Written only by `updateDecalAtlas`. */
let leftTexturesOut = false;

/** The one atlas, an empty one until a texture joins it. Its identity never changes. */
export function decalAtlasTexture(): THREE.Texture {
  if (atlasTexture.mipmaps.length === 0)
    holdAtlasLevels(atlasTexture, decalAtlasLevels(packDecalAtlas([]), []));
  return atlasTexture;
}

/** Puts `texture` in the atlas for one more holder (`texture_add_to_decal_atlas`). */
export function holdDecalTexture(texture: THREE.Texture): void {
  holders.hold(texture);
}

/**
 * Lets go of `texture` for one holder, and removes it with the last (`texture_remove_from_decal_atlas`).
 * A texture left out for size gets another build then, as the room it held may fit one.
 */
export function releaseDecalTexture(texture: THREE.Texture): void {
  if (!holders.release(texture)) return;
  rects.delete(texture);
  if (leftTexturesOut) holders.markChanged();
}

/** Where `texture` lies in the atlas, or undefined for a texture the atlas does not hold. */
export function decalAtlasRect(texture: THREE.Texture): DecalAtlasRect | undefined {
  return rects.get(texture);
}

/**
 * Rebuilds the atlas when a texture joined or changed its pixels since the last build
 * (`update_decal_atlas`). `maxTextureSize` is the GPU's: textures that would push the atlas past it
 * stay out, the last to join first, and the rest still draw.
 */
export function updateDecalAtlas(maxTextureSize: number): void {
  const changed = holders.takeChanged();
  if (!changed) return;
  const readable = readableTextures(changed);
  const { layout, wanted } = fitDecalAtlas(
    readable.map(({ image }) => image),
    maxTextureSize
  );
  leftTexturesOut = wanted !== undefined;
  if (wanted) {
    console.warn(
      `The decal atlas needs ${wanted.width}x${wanted.height} but the GPU allows ${maxTextureSize}: ` +
        `${readable.length - layout.rects.length} decal textures are not drawn.`
    );
  }
  const placed = readable.slice(0, layout.rects.length);
  rects = new Map(placed.map(({ texture }, index) => [texture, fractionsOf(layout, index)]));
  holdAtlasLevels(
    atlasTexture,
    decalAtlasLevels(
      layout,
      placed.map(({ image }) => image)
    )
  );
}

function fractionsOf({ width, height, rects: pixels }: DecalAtlasLayout, index: number): DecalAtlasRect {
  const rect = pixels[index]!;
  return { x: rect.x / width, y: rect.y / height, width: rect.width / width, height: rect.height / height };
}
