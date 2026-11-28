import { describe, expect, it } from 'vitest';
import { areaAtlasLevels, areaPlacement, buildAreaLightAtlas } from './atlasLayout';
import type { GodotImage } from '../textureAtlas/godotImage';
import type { ImageSize } from '../../resources/formats/image/imagePixels';
import { mipSize } from '../../resources/processing/mipChain';

/** A `width × height` image whose texel at `x`, `y` is `rgbaAt(x, y)`, in sRGB bytes. */
function image(
  width: number,
  height: number,
  rgbaAt: (x: number, y: number) => readonly number[]
): GodotImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) data.set(rgbaAt(x, y), (y * width + x) * 4);
  }
  return { width, height, data };
}

const solid = (width: number, height: number, rgba: readonly number[]) => image(width, height, () => rgba);

function placedAtlas(sizes: readonly ImageSize[]) {
  const layout = buildAreaLightAtlas(sizes);
  return {
    ...layout,
    placements: layout.rects.map((rect) => areaPlacement(rect, layout)),
  };
}

function filledAtlas(images: readonly GodotImage[]) {
  const layout = buildAreaLightAtlas(images);
  return { ...layout, mipmaps: areaAtlasLevels(layout, images).map(({ data }) => data) };
}

/** The RGBA bytes of mip `level` at texel `x`, `y`. */
function texel(level: number, x: number, y: number, atlas: ReturnType<typeof filledAtlas>): number[] {
  const width = mipSize(atlas.width, level);
  const at = (y * width + x) * 4;
  return [...atlas.mipmaps[level]!.subarray(at, at + 4)];
}

describe('buildAreaLightAtlas', () => {
  it('places one 64×64 texture in the corner of a 256×256 atlas, with five mips to sample', () => {
    const atlas = placedAtlas([{ width: 64, height: 64 }]);

    expect([atlas.width, atlas.height]).toEqual([256, 256]);
    expect(atlas.placements[0]).toEqual({ rect: { x: 0, y: 0, width: 0.25, height: 0.25 }, maxMipmap: 5 });
  });

  it('stretches a 200×100 texture to whole cells, 256×128, with six mips to sample', () => {
    const atlas = placedAtlas([{ width: 200, height: 100 }]);

    expect([atlas.width, atlas.height]).toEqual([512, 256]);
    expect(atlas.placements[0]).toEqual({ rect: { x: 0, y: 0, width: 0.5, height: 0.5 }, maxMipmap: 6 });
  });

  it('packs the wider texture first and stacks the other beneath it', () => {
    const atlas = placedAtlas([
      { width: 64, height: 64 },
      { width: 200, height: 100 },
    ]);

    expect([atlas.width, atlas.height]).toEqual([512, 512]);
    expect(atlas.placements.map((placement) => placement.rect)).toEqual([
      { x: 0, y: 0.5, width: 0.125, height: 0.125 },
      { x: 0, y: 0, width: 0.5, height: 0.25 },
    ]);
  });

  it('holds an empty atlas of one blank cell with all eight mips (edge case)', () => {
    const atlas = filledAtlas([]);

    expect([atlas.width, atlas.height, atlas.mipmaps.length]).toEqual([128, 128, 8]);
    expect(atlas.mipmaps[0]!.every((byte) => byte === 0)).toBe(true);
  });

  it('decodes mip 0 from sRGB and leaves the border clear', () => {
    const atlas = filledAtlas([solid(64, 64, [188, 188, 188, 255])]);

    expect(texel(0, 0, 0, atlas)).toEqual([128, 128, 128, 255]);
    expect(texel(0, 64, 0, atlas)).toEqual([0, 0, 0, 0]);
  });

  it("blurs a two-texel mip with the window's alternating clamp, before it decodes it", () => {
    // Black left half, white right half. At two texels each window entry reads one half in turn,
    // so the left texel sums 0.522364 of the white and the right one 0.477635: sRGB bytes 133 and
    // 122, decoded to 60 and 50.
    const atlas = filledAtlas([image(4, 4, (x) => (x < 2 ? [0, 0, 0, 255] : [255, 255, 255, 255]))]);

    expect([texel(1, 0, 0, atlas)[0], texel(1, 1, 0, atlas)[0]]).toEqual([60, 50]);
  });
});
