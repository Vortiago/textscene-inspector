/**
 * The one decal atlas every Decal samples its albedo, normal, ORM and emission textures from, as
 * Godot keeps one for every viewport (`texture_storage.cpp:3038-3258`). Each Decal holds each of
 * its textures while it projects them, and a Decal rebuilds the atlas before a render when a
 * texture joined it or changed its pixels. `decalAtlasLayout.ts` lays it out and
 * `decalAtlasLevels.ts` fills its levels.
 */

import * as THREE from 'three';
import { releasedOnUnmount } from '../../../r3f/sharedTexture.js';
import { AtlasHolders } from '../../../r3f/textureAtlas/atlasHolders.js';
import { fractionOfAtlas } from '../../../r3f/textureAtlas/atlasFraction.js';
import type { AtlasRect } from '../../../resources/textures/atlastexture/types.js';
import { AtlasTexture, holdAtlasLevels } from '../../../r3f/textureAtlas/atlasTexture.js';
import { readableTextures } from '../../../r3f/textureAtlas/godotImage.js';
import { fitDecalAtlas, packDecalAtlas } from './decalAtlasLayout.js';
import type { MipLevel } from '../../../resources/processing/mipChain.js';
import type { TextureFilterState } from '../../../resources/textures/godotTextureFilter.js';
import { decalAtlasLevels } from './decalAtlasLevels.js';

/**
 * Godot reads albedo and emission through the sRGB view of an RGBA8 texture, and normal and ORM
 * through its linear view (`render_forward_clustered.cpp:3205-3213`). WebGL has one view, so this is the
 * sRGB one, and the Decal term encodes a normal or ORM texel back to its bytes.
 */
const atlasTexture = releasedOnUnmount(new AtlasTexture('DecalAtlas', THREE.SRGBColorSpace));

/** Each held texture, as Godot's map keeps them. */
const holders = new AtlasHolders();

/**
 * Where the last build placed each held texture it could read and fit. Written by
 * `updateDecalAtlas`, and cleared of a texture the moment its last holder lets go.
 */
let rects = new Map<THREE.Texture, AtlasRect>();

/** Whether the last build left a readable texture out for the GPU's size. Written only by `updateDecalAtlas`. */
let leftTexturesOut = false;

/** The one atlas, an empty one until a texture joins it. Its identity never changes. */
export function decalAtlasTexture(): THREE.Texture {
  if (atlasTexture.mipmaps.length === 0)
    holdAtlasLevels(atlasTexture, decalAtlasLevels(packDecalAtlas([]), []));
  return atlasTexture;
}

/**
 * Samples the atlas as the decal filter says (`render_forward_clustered.cpp:3436-3460`). The atlas
 * keeps its own chain whatever the filter, so a filter that reads none leaves the levels unread.
 * A change uploads the atlas again; the same filter changes nothing.
 */
export function setDecalAtlasFilter({ magFilter, minFilter, anisotropy }: TextureFilterState): void {
  if (
    atlasTexture.magFilter === magFilter &&
    atlasTexture.minFilter === minFilter &&
    atlasTexture.anisotropy === anisotropy
  )
    return;
  atlasTexture.magFilter = magFilter;
  atlasTexture.minFilter = minFilter;
  atlasTexture.anisotropy = anisotropy;
  atlasTexture.needsUpdate = true;
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
export function decalAtlasRect(texture: THREE.Texture): AtlasRect | undefined {
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
  rects = new Map(
    placed.map(({ texture }, index) => [texture, fractionOfAtlas(layout.rects[index]!, layout)])
  );
  holdAtlasLevels(
    atlasTexture,
    decalAtlasLevels(
      layout,
      placed.map(({ image }) => image),
      atlasTexture.mipmaps as MipLevel[]
    )
  );
}
