import { describe, it, expect } from 'vitest';
import { sceneTileCells } from './sceneTileCells';
import { TILE_TRANSFORM_FLIP_H } from '../../godot/scene/tileSet';
import type { PlacedCell } from '../../nodes/2d/tiles/shared/tileData';
import type { SceneTileModel } from './types';

const SCENE_TILE: SceneTileModel = {
  scene: { ref: 'ExtResource("5")', externalResources: [], internalResources: [] },
  displayPlaceholder: false,
};

const model = { sources: new Map(), sceneSources: new Map([[2, { scenes: new Map([[1, SCENE_TILE]]) }]]) };

const cell = (overrides: Partial<PlacedCell>): PlacedCell => ({
  coords: { x: 0, y: 0 },
  sourceId: 2,
  atlasCoords: { x: 0, y: 0 },
  alternativeId: 1,
  ...overrides,
});

const named = (cells: PlacedCell[]) => sceneTileCells(model, cells);

describe('sceneTileCells', () => {
  it('names a cell whose source is a scene collection, at atlas (0, 0), by its scene id', () => {
    const [found] = named([cell({})]);
    expect(found!.tile).toBe(SCENE_TILE);
  });

  it('reads the scene id with the transform bits cleared (tile_set.cpp:5775-5778)', () => {
    expect(named([cell({ alternativeId: 1 | TILE_TRANSFORM_FLIP_H })])).toHaveLength(1);
  });

  it.each([
    ['a scene id the source lacks', cell({ alternativeId: 9 })],
    ['atlas coords other than (0, 0)', cell({ atlasCoords: { x: 1, y: 0 } })],
    ['a source the TileSet lacks', cell({ sourceId: 7 })],
  ])('leaves out a cell with %s', (_name, odd) => {
    expect(named([odd])).toEqual([]);
  });

  it('keeps the order of the cells', () => {
    const found = named([cell({ coords: { x: 3, y: 0 } }), cell({ coords: { x: 1, y: 0 } })]);
    expect(found.map((entry) => entry.cell.coords.x)).toEqual([3, 1]);
  });
});
