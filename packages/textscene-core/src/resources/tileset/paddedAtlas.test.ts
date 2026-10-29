/**
 * Godot's padded atlas layout: each tile at its atlas coordinates on a grid of cells one texel wider
 * on each side than the texture region (`tile_set.cpp:5333-5345`, `:5638`).
 */
import { describe, expect, it } from 'vitest';
import { paddedTileRegion } from './paddedAtlas';

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
