import { describe, expect, it } from 'vitest';
import { TILE_TRANSFORM_FLIP_H, TILE_TRANSFORM_TRANSPOSE } from '../../godot/scene/tileSet';
import type { DrawableCell } from '../../resources/tileset/drawableCell';
import { defaultTileData, type AtlasSourceModel, type TileGrid } from '../../resources/tileset/types';
import { tileRectCommands } from './tileCommands';

const GRID: TileGrid = { shape: 0, layout: 0, offsetAxis: 0, tileSize: { x: 16, y: 16 } };
const TILE = { sizeInAtlas: { x: 1, y: 1 }, alternatives: new Map() };

function sourceOf(usesTexturePadding = false): AtlasSourceModel {
  return {
    texture: null,
    margins: { x: 0, y: 0 },
    separation: { x: 0, y: 0 },
    textureRegionSize: { x: 16, y: 16 },
    usesTexturePadding,
    tiles: new Map([['1:0', TILE]]),
  };
}

function cellAt(x: number, alternativeId = 0, source = sourceOf()): DrawableCell {
  const tileData = { ...defaultTileData(), modulate: { r: 1, g: 0.5, b: 1, a: 1 } };
  return {
    coords: { x, y: 0 },
    sourceId: 0,
    atlasCoords: { x: 1, y: 0 },
    alternativeId,
    source,
    tile: TILE,
    tileData,
  };
}

/** The rect of a 16 px tile centred on cell 1 of a 16 px grid, grown by Godot's `FP_ADJUST` of 0.00001. */
const CENTRED = { x: 16 - 0.000005, y: -0.000005, w: 16.00001, h: 16.00001 };

const rounded = (rect: { x: number; y: number; w: number; h: number }) =>
  Object.values(rect).map((value) => Number(value.toFixed(6)));

const drawn = (cell: DrawableCell, usesUvClipping = false) => {
  const [command] = tileRectCommands([cell], { grid: GRID, usesUvClipping });
  if (command?.kind !== 'rect') throw new Error(`expected a rect command, got ${command?.kind}`);
  return command;
};

describe('tileRectCommands', () => {
  it("centres the tile's region on its cell, with the tile's modulate", () => {
    const { region, modulate } = drawn(cellAt(1));

    expect([rounded(region.rect), region.source, modulate]).toEqual([
      rounded(CENTRED),
      { x: 16, y: 0, w: 16, h: 16 },
      { r: 1, g: 0.5, b: 1, a: 1 },
    ]);
  });

  it('flips by a negative width, keeping the rect on its cell', () => {
    const { rect } = drawn(cellAt(1, TILE_TRANSFORM_FLIP_H)).region;

    expect(rounded(rect)).toEqual(rounded({ ...CENTRED, w: -CENTRED.w }));
  });

  it('marks a transposed cell for the rect to swap its axes', () => {
    expect(drawn(cellAt(1, TILE_TRANSFORM_TRANSPOSE)).region.transpose).toBe(true);
  });

  it("reads a padded source's region one texel into its padded cell", () => {
    expect(drawn(cellAt(1, 0, sourceOf(true))).region.source).toEqual({ x: 19, y: 1, w: 16, h: 16 });
  });

  it("clips the UV to the region with the TileSet's uv_clipping", () => {
    expect(drawn(cellAt(1), true).region.clipUv).toBe(true);
  });
});
