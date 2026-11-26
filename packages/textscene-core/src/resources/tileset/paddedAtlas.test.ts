/**
 * Godot's padded atlas layout: each tile at its atlas coordinates on a grid of cells one texel wider
 * on each side than the texture region (`tile_set.cpp:5333-5345`, `:5638`).
 */
import { describe, expect, it } from 'vitest';
import type { ImagePixels } from '../formats/image/imagePixels';
import { reversedRows } from '../../utils/reversedRows';
import { atlasGridSize, bottomUpPaddedAtlasPixels, paddedAtlasPixels, paddedTileRegion } from './paddedAtlas';
import type { AtlasSourceModel } from './types';

const source = {
  textureRegionSize: { x: 16, y: 16 },
};

describe('paddedTileRegion', () => {
  it('places a tile one texel inside its padded cell', () => {
    const region = paddedTileRegion(source, { x: 1, y: 0 }, { width: 16, height: 16 });
    expect(region).toEqual({ x: 19, y: 1, width: 16, height: 16 });
  });

  it("keeps a large tile's own region size (edge case)", () => {
    const region = paddedTileRegion(source, { x: 0, y: 1 }, { width: 32, height: 16 });
    expect(region).toEqual({ x: 1, y: 19, width: 32, height: 16 });
  });
});

describe('atlasGridSize', () => {
  const textureSize = { width: 20, height: 14 };

  it('counts the cells that fit after the margins, with separation between them', () => {
    const grid = atlasGridSize(
      { margins: { x: 2, y: 1 }, separation: { x: 1, y: 1 }, textureRegionSize: { x: 4, y: 4 } },
      textureSize
    );
    expect(grid).toEqual({ x: 3, y: 2 });
  });

  it('is empty for a region size of 0', () => {
    const grid = atlasGridSize(
      { margins: { x: 0, y: 0 }, separation: { x: 0, y: 0 }, textureRegionSize: { x: 0, y: 4 } },
      textureSize
    );
    expect(grid).toEqual({ x: 0, y: 0 });
  });

  it('is empty when the texture is smaller than one region', () => {
    const grid = atlasGridSize(
      { margins: { x: 0, y: 0 }, separation: { x: 0, y: 0 }, textureRegionSize: { x: 32, y: 4 } },
      textureSize
    );
    expect(grid).toEqual({ x: 0, y: 0 });
  });
});

/** An image whose red channel holds `values` row by row, with full alpha. */
function redImage(width: number, values: number[]): ImagePixels {
  const data = new Uint8Array(values.length * 4);
  values.forEach((value, i) => data.set([value, 0, 0, 255], i * 4));
  return { width, height: values.length / width, data };
}

function redRows(image: ImagePixels): number[][] {
  const rows: number[][] = [];
  for (let y = 0; y < image.height; y++) {
    rows.push(Array.from({ length: image.width }, (_, x) => image.data[(y * image.width + x) * 4]!));
  }
  return rows;
}

function atlasOf(tiles: Array<[string, { x: number; y: number }]>, regionSize: number): AtlasSourceModel {
  return {
    texture: null,
    margins: { x: 0, y: 0 },
    separation: { x: 0, y: 0 },
    textureRegionSize: { x: regionSize, y: regionSize },
    usesTexturePadding: true,
    tiles: new Map(tiles.map(([key, sizeInAtlas]) => [key, { sizeInAtlas, alternatives: new Map() }])),
  };
}

describe('paddedAtlasPixels', () => {
  const twoByOne = redImage(4, [1, 2, 5, 6, 3, 4, 7, 8]);

  it('repeats a tile edge texels on each side and corner', () => {
    const padded = paddedAtlasPixels(twoByOne, atlasOf([['0:0', { x: 1, y: 1 }]], 2));
    expect(redRows(padded).map((row) => row.slice(0, 4))).toEqual([
      [1, 1, 2, 2],
      [1, 1, 2, 2],
      [3, 3, 4, 4],
      [3, 3, 4, 4],
    ]);
  });

  it('sizes the image to the grid of padded cells', () => {
    const padded = paddedAtlasPixels(twoByOne, atlasOf([['0:0', { x: 1, y: 1 }]], 2));
    expect([padded.width, padded.height]).toEqual([8, 4]);
  });

  it('places the second tile in its own cell', () => {
    const padded = paddedAtlasPixels(twoByOne, atlasOf([['1:0', { x: 1, y: 1 }]], 2));
    expect(redRows(padded).map((row) => row.slice(4))).toEqual([
      [5, 5, 6, 6],
      [5, 5, 6, 6],
      [7, 7, 8, 8],
      [7, 7, 8, 8],
    ]);
  });

  it('leaves the cell of a missing tile zero', () => {
    const padded = paddedAtlasPixels(twoByOne, atlasOf([['0:0', { x: 1, y: 1 }]], 2));
    expect(redRows(padded).map((row) => row.slice(4))).toEqual([
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]);
  });

  it('starts every texel zero', () => {
    const padded = paddedAtlasPixels(twoByOne, atlasOf([], 2));
    expect(padded.data.every((byte) => byte === 0)).toBe(true);
  });

  it('clips a region that runs past the source image as blit_rect does', () => {
    const narrow = redImage(3, [1, 2, 3, 4, 5, 6]);
    const padded = paddedAtlasPixels(narrow, atlasOf([['0:0', { x: 2, y: 1 }]], 2));
    expect(redRows(padded)).toEqual([
      [1, 1, 2, 3],
      [1, 1, 2, 3],
      [4, 4, 5, 6],
      [4, 4, 5, 6],
    ]);
  });
});

describe('bottomUpPaddedAtlasPixels', () => {
  const twoByOne = redImage(4, [1, 2, 5, 6, 3, 4, 7, 8]);
  const layout = atlasOf([['0:0', { x: 1, y: 1 }]], 2);

  it('gives the padded atlas with its bottom row first', () => {
    const padded = bottomUpPaddedAtlasPixels(twoByOne, false, layout);
    expect(redRows(padded).map((row) => row.slice(0, 4))).toEqual([
      [3, 3, 4, 4],
      [3, 3, 4, 4],
      [1, 1, 2, 2],
      [1, 1, 2, 2],
    ]);
  });

  it('reads bottom-up pixels as the same image stored the other way up', () => {
    const { width, height } = twoByOne;
    const bottomUp = { data: reversedRows(twoByOne.data, width, height), width, height };

    expect(bottomUpPaddedAtlasPixels(bottomUp, true, layout)).toEqual(
      bottomUpPaddedAtlasPixels(twoByOne, false, layout)
    );
  });
});
