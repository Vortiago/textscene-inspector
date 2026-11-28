import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { ImageSize } from '../../resources/formats/image/imagePixels';
import type { AtlasRect } from '../../resources/textures/atlastexture/types';
import { fitAtlas } from './fitAtlas';
import { createTextureAtlas } from './textureAtlas';

function texture(width: number) {
  return new THREE.DataTexture(new Uint8Array(width * 4), width, 1);
}

function rowAtlas(slot: { atlasTexture?: THREE.DataTexture } = {}, offset = 0) {
  const levels = vi.fn(({ width, height }: ImageSize) =>
    [1, 2].map((factor) => ({
      width: width / factor,
      height: height / factor,
      data: new Uint8Array((width / factor) * (height / factor) * 4),
    }))
  );
  const atlas = createTextureAtlas(
    {
      name: 'RowAtlas',
      colorSpace: THREE.NoColorSpace,
      pack(sizes, limit) {
        const row = (count: number) => {
          let width = 0;
          const rects = sizes.slice(0, count).map((size) => {
            const x = width;
            width += size.width;
            return { x, y: 0, ...size };
          });
          return { width: Math.max(2, width), height: 2, rects };
        };
        return fitAtlas(sizes.length, row, limit, () => sizes.length);
      },
      place: (rect: AtlasRect) => rect.x + offset,
      levels,
    },
    slot
  );
  return { atlas, levels };
}

describe('the shared atlas lifecycle', () => {
  it('packs readable textures in join order and builds the levels once', () => {
    const { atlas, levels } = rowAtlas();
    const first = texture(4);
    const second = texture(2);
    atlas.hold(first);
    atlas.hold(new THREE.Texture());
    atlas.hold(second);
    atlas.hold(first);

    atlas.update(8);
    atlas.update(8);

    expect([atlas.placement(first), atlas.placement(second)]).toEqual([0, 4]);
    expect(levels).toHaveBeenCalledTimes(1);
    first.needsUpdate = true;
    atlas.update(8);
    expect(levels).toHaveBeenCalledTimes(2);
  });

  it('drops only the last hold and retains the other placements', () => {
    const { atlas, levels } = rowAtlas();
    const first = texture(4);
    const second = texture(2);
    atlas.hold(first);
    atlas.hold(first);
    atlas.hold(second);
    atlas.update(8);

    atlas.release(first);
    expect(atlas.placement(first)).toBe(0);
    atlas.release(first);
    atlas.release(first);
    atlas.update(8);

    expect(atlas.placement(first)).toBeUndefined();
    expect(atlas.placement(second)).toBe(4);
    expect(levels).toHaveBeenCalledTimes(1);
  });

  it('builds levels only for the prefix that fits and admits the next texture when room opens', () => {
    const { atlas, levels } = rowAtlas();
    const first = texture(4);
    const second = texture(4);
    atlas.hold(first);
    atlas.hold(second);
    atlas.update(4);

    expect(atlas.placement(second)).toBeUndefined();
    expect(levels.mock.calls[0]![0].width).toBe(4);
    expect(levels).toHaveBeenCalledTimes(1);
    atlas.release(first);
    atlas.update(4);
    expect(atlas.placement(second)).toBe(0);
  });

  it('refits the same sources when another renderer has a different limit', () => {
    const { atlas } = rowAtlas();
    const sources = [texture(4), texture(4)];
    sources.forEach(atlas.hold);
    atlas.update(8);
    const identity = atlas.texture();
    atlas.update(4);
    expect(atlas.placement(sources[1]!)).toBeUndefined();
    atlas.update(8);
    expect(atlas.placement(sources[1]!)).toBe(4);
    expect(atlas.texture()).toBe(identity);
  });

  it('keeps a live holder through reload until the original owner releases it', () => {
    const slot = {};
    const first = rowAtlas(slot).atlas;
    const source = texture(4);
    first.hold(source);
    first.update(8);

    const second = rowAtlas(slot).atlas;
    second.update(8);
    expect(second.placement(source)).toBe(0);
    first.release(source);
    expect(second.placement(source)).toBeUndefined();
  });

  it('applies the new layout to unchanged sources after a reload', () => {
    const slot = {};
    const first = rowAtlas(slot).atlas;
    const source = texture(4);
    first.hold(source);
    first.update(8);

    const second = rowAtlas(slot, 2).atlas;
    second.update(8);
    expect(second.placement(source)).toBe(2);
  });

  it('fills the empty texture on first use and reuses it after a reload', () => {
    const slot = {};
    const first = rowAtlas(slot);
    expect(first.levels).not.toHaveBeenCalled();
    const identity = first.atlas.texture();
    expect(identity.mipmaps).toHaveLength(2);
    expect(first.atlas.texture()).toBe(identity);
    expect(first.levels).toHaveBeenCalledTimes(1);
    const second = rowAtlas(slot);
    expect(second.atlas.texture()).toBe(identity);
    expect(second.levels).not.toHaveBeenCalled();
  });
});
