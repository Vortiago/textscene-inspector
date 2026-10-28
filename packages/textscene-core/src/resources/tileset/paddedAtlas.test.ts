/**
 * Godot's padded atlas layout: each tile at its atlas coordinates on a grid of cells one texel wider
 * on each side than the texture region (`tile_set.cpp:5333-5345`, `:5638`).
 */
import { describe, expect, it } from 'vitest';
import { paddedAtlasSize, paddedTileRegion } from './paddedAtlas';

const source = {
  margins: { x: 0, y: 0 },
  separation: { x: 0, y: 0 },
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

describe('paddedAtlasSize', () => {
  it('is the atlas grid, each cell padded by one texel on each side', () => {
    expect(paddedAtlasSize(source, { width: 32, height: 32 })).toEqual({ x: 36, y: 36 });
  });

  it('counts only whole regions after the margins, across separations', () => {
    const spaced = { ...source, margins: { x: 2, y: 0 }, separation: { x: 1, y: 0 } };
    expect(paddedAtlasSize(spaced, { width: 52, height: 16 })).toEqual({ x: 54, y: 18 });
  });

  it('is empty for a texture smaller than one region (edge case)', () => {
    expect(paddedAtlasSize(source, { width: 8, height: 32 })).toEqual({ x: 0, y: 0 });
  });
});
