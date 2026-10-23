import { describe, expect, it } from 'vitest';
import { decalAtlasLevels } from './decalAtlasLevels';
import { packDecalAtlas } from './decalAtlasLayout';
import type { GodotImage } from '../../../r3f/textureAtlas/godotImage';

/** A `size × size` image of one RGBA colour. */
function solid(size: number, rgba: readonly number[]): GodotImage {
  const data = new Uint8Array(size * size * 4);
  for (let texel = 0; texel < size * size; texel++) data.set(rgba, texel * 4);
  return { width: size, height: size, data };
}

/** The RGBA bytes of `level` at (`x`, `y`). */
function texelAt(level: { data: Uint8Array; width: number }, x: number, y: number): number[] {
  const at = (y * level.width + x) * 4;
  return [...level.data.subarray(at, at + 4)];
}

const RED = [200, 100, 50, 255];
const BLUE = [10, 20, 240, 128];

/** Two 1 × 1 textures: cells 1 × 1, so the first sits at cell 0 and the second at cell 1. A 256 × 32 atlas. */
function twoTextureAtlas() {
  const images = [solid(1, RED), solid(1, BLUE)];
  const layout = packDecalAtlas(images);
  return { layout, levels: decalAtlasLevels(layout, images) };
}

describe('decalAtlasLevels', () => {
  it('holds five levels, each half the size of the one before (texture_storage.h:274, :3205)', () => {
    const { levels } = twoTextureAtlas();
    expect(levels.map(({ width, height }) => `${width}x${height}`)).toEqual([
      '256x32',
      '128x16',
      '64x8',
      '32x4',
      '16x2',
    ]);
  });

  it('copies each texture into its rectangle over transparent black (:3174, :3209-3218)', () => {
    const { layout, levels } = twoTextureAtlas();
    expect(layout.rects.map(({ x, y }) => [x, y])).toEqual([
      [16, 16],
      [48, 16],
    ]);
    expect(texelAt(levels[0]!, 16, 16)).toEqual(RED);
    expect(texelAt(levels[0]!, 48, 16)).toEqual(BLUE);
    expect(texelAt(levels[0]!, 17, 16)).toEqual([0, 0, 0, 0]);
    expect(texelAt(levels[0]!, 15, 15)).toEqual([0, 0, 0, 0]);
  });

  it('averages the 2 x 2 block of the level above, padding included (:3220-3222)', () => {
    const { levels } = twoTextureAtlas();
    // Level 1 texel (8, 8) averages level 0 texels (16..17, 16..17): one red and three clear.
    // Each channel is (value + 0 + 0 + 0 + 2) >> 2: 202 >> 2 = 50, 102 >> 2 = 25, 52 >> 2 = 13, 257 >> 2 = 64.
    expect(texelAt(levels[1]!, 8, 8)).toEqual([50, 25, 13, 64]);
    // Level 2 texel (4, 4) averages level 1 texels (8..9, 8..9): 52 >> 2 = 13, 27 >> 2 = 6, 15 >> 2 = 3, 66 >> 2 = 16.
    expect(texelAt(levels[2]!, 4, 4)).toEqual([13, 6, 3, 16]);
  });

  it('keeps a texture top row first, as Godot copies it', () => {
    const top = [...RED, ...RED];
    const bottom = [...BLUE, ...BLUE];
    const image: GodotImage = { width: 2, height: 2, data: new Uint8Array([...top, ...bottom]) };
    const [level] = decalAtlasLevels(packDecalAtlas([image]), [image]);
    expect(texelAt(level!, 16, 16)).toEqual(RED);
    expect(texelAt(level!, 17, 17)).toEqual(BLUE);
  });

  describe('over the levels of the last build', () => {
    it('writes the same size over its buffers, and gives the bytes a fresh build gives', () => {
      const images = [solid(1, RED), solid(1, BLUE)];
      const layout = packDecalAtlas(images);
      const last = decalAtlasLevels(layout, images);
      const buffers = last.map(({ data }) => data);

      const rebuilt = decalAtlasLevels(layout, images, last);

      expect(rebuilt.map(({ data }) => data)).toEqual(buffers);
      rebuilt.forEach(({ data }, level) => expect(data).toBe(buffers[level]));
      expect(rebuilt).toEqual(decalAtlasLevels(layout, images));
    });

    it('leaves nothing of a texture that left (edge case)', () => {
      const both = [solid(1, RED), solid(1, BLUE)];
      const last = decalAtlasLevels(packDecalAtlas(both), both);
      const remaining = [solid(1, RED)];

      const rebuilt = decalAtlasLevels(packDecalAtlas(remaining), remaining, last);

      expect(texelAt(rebuilt[0]!, 48, 16)).toEqual([0, 0, 0, 0]);
      expect(rebuilt).toEqual(decalAtlasLevels(packDecalAtlas(remaining), remaining));
    });

    it('allocates new buffers when the atlas changes size (edge case)', () => {
      const small = [solid(1, RED)];
      const last = decalAtlasLevels(packDecalAtlas(small), small);
      const wide = [solid(1, RED), solid(40, BLUE)];

      const rebuilt = decalAtlasLevels(packDecalAtlas(wide), wide, last);

      rebuilt.forEach(({ data }) => expect(last.some((level) => level.data === data)).toBe(false));
      expect(rebuilt).toEqual(decalAtlasLevels(packDecalAtlas(wide), wide));
    });
  });
});
