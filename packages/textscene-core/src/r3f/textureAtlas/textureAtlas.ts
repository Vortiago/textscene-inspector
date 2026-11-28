import type * as THREE from 'three';
import * as logger from '../../logger.js';
import type { ImageSize } from '../../resources/formats/image/imagePixels.js';
import type { MipLevel } from '../../resources/processing/mipChain.js';
import type { AtlasRect } from '../../resources/textures/atlastexture/types.js';
import { releasedOnUnmount } from '../sharedTexture.js';
import { AtlasHolders } from './atlasHolders.js';
import { AtlasTexture, holdAtlasLevels } from './atlasTexture.js';
import { fitAtlas, type AtlasLayout } from './fitAtlas.js';
import { readableTextures, type GodotImage } from './godotImage.js';

interface AtlasFormat<Placement> {
  name: string;
  colorSpace: THREE.ColorSpace;
  pack(sizes: readonly ImageSize[]): AtlasLayout;
  place(rect: AtlasRect, layout: AtlasLayout): Placement;
  levels(layout: AtlasLayout, images: readonly GodotImage[], reusable: readonly MipLevel[]): MipLevel[];
}

interface AtlasState<Placement> {
  holders: AtlasHolders;
  placements: Map<THREE.Texture, Placement>;
  leftTexturesOut: boolean;
  previousLimit?: number;
}

type OwnedAtlas<Placement> = THREE.DataTexture & { atlasState?: AtlasState<Placement> };

/** @canonical The texture, holders and placements of a shared texture atlas */
export function createTextureAtlas<Placement>(
  format: AtlasFormat<Placement>,
  slot: { atlasTexture?: THREE.DataTexture }
) {
  const texture: OwnedAtlas<Placement> = releasedOnUnmount(
    (slot.atlasTexture ??= new AtlasTexture(format.name, format.colorSpace))
  );
  // A reloaded module shares the live holders with the release callbacks of the previous module.
  const state: AtlasState<Placement> = (texture.atlasState ??= {
    holders: new AtlasHolders(),
    placements: new Map(),
    leftTexturesOut: false,
  });
  const { holders, placements } = state;

  function update(maxTextureSize: number): void {
    if (maxTextureSize !== state.previousLimit) holders.markChanged();
    const changed = holders.takeChanged();
    if (!changed) return;
    const readable = readableTextures(changed);
    const images = readable.map(({ image }) => image);
    const { layout, wanted } = fitAtlas(format.pack, images, maxTextureSize);
    const count = layout.rects.length;
    if (wanted) {
      logger.warn(
        `[${format.name}] The atlas needs ${wanted.width}x${wanted.height} texels. The GPU limit is ${maxTextureSize}. ` +
          `${images.length - count} textures stay out.`
      );
    }
    holdAtlasLevels(texture, format.levels(layout, images.slice(0, count), texture.mipmaps as MipLevel[]));
    placements.clear();
    layout.rects.forEach((rect, index) =>
      placements.set(readable[index]!.texture, format.place(rect, layout))
    );
    state.leftTexturesOut = wanted !== undefined;
    state.previousLimit = maxTextureSize;
  }

  return {
    texture(): THREE.DataTexture {
      if (texture.mipmaps.length === 0) holdAtlasLevels(texture, format.levels(format.pack([]), [], []));
      return texture;
    },
    hold(source: THREE.Texture): void {
      holders.hold(source);
    },
    release(source: THREE.Texture): void {
      if (!holders.release(source)) return;
      placements.delete(source);
      if (state.leftTexturesOut) holders.markChanged();
    },
    placement(source: THREE.Texture): Placement | undefined {
      return placements.get(source);
    },
    update,
  };
}
