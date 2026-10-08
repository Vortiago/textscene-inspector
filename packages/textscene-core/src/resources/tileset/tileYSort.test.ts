import { describe, it, expect } from 'vitest';
import { groupBySortY } from './tileYSort';
import type { TileGrid } from './types';
import type { DrawableCell } from './drawableCell';
import { drawableCellOf } from './testing/drawableCellOf';

const squareGrid: TileGrid = {
  shape: 0, // square
  layout: 0,
  offsetAxis: 0,
  tileSize: { x: 32, y: 32 },
};

const isoGrid: TileGrid = {
  shape: 1, // isometric
  layout: 0,
  offsetAxis: 0,
  tileSize: { x: 64, y: 32 },
};

function cell(coords: { x: number; y: number }, sourceId = 0, atlasX = 0, atlasY = 0): DrawableCell {
  return drawableCellOf({ coords, sourceId, atlasCoords: { x: atlasX, y: atlasY } });
}

describe('groupBySortY', () => {
  it('groups cells at different Ys into separate groups, sorted low-to-high', () => {
    const cells = [
      cell({ x: 0, y: 0 }, 0, 0, 0), // center = (16, 16)
      cell({ x: 0, y: 1 }, 0, 0, 1), // center = (16, 48)
      cell({ x: 0, y: -1 }, 0, 0, -1), // center = (16, -16)
    ];
    const groups = groupBySortY(cells, squareGrid, 0, 0);
    expect(groups.length).toBe(3);
    // Low Y (far back) draws first → lowest sortY group first
    expect(groups[0]!.sortY).toBeLessThan(groups[1]!.sortY);
    expect(groups[1]!.sortY).toBeLessThan(groups[2]!.sortY);
    expect(groups[0]!.cells.length).toBe(1);
    expect(groups[1]!.cells.length).toBe(1);
    expect(groups[2]!.cells.length).toBe(1);
  });

  it('groups cells at same Y into a single group', () => {
    const cells = [
      cell({ x: 0, y: 0 }, 0, 0, 0),
      cell({ x: 1, y: 0 }, 0, 1, 0),
      cell({ x: 0, y: 0 }, 1, 0, 0),
    ];
    const groups = groupBySortY(cells, squareGrid, 0, 0);
    expect(groups.length).toBe(1);
    expect(groups[0]!.cells.length).toBe(3);
  });

  it("sorts a group's cells by x, then y, as Godot sorts a quadrant's (tile_map_layer.cpp:306-311)", () => {
    const cells = [cell({ x: 2, y: 0 }), cell({ x: -1, y: 0 }), cell({ x: 0, y: 0 })];
    const groups = groupBySortY(cells, squareGrid, 0, 0);
    expect(groups[0]!.cells.map(({ coords }) => coords.x)).toEqual([-1, 0, 2]);
  });

  it('y_sort_origin shifts all groups uniformly', () => {
    const cells = [
      cell({ x: 0, y: 0 }, 0, 0, 0), // sortY = 0 + 16 + 0 = 16
      cell({ x: 0, y: 1 }, 0, 0, 1), // sortY = 0 + 48 + 0 = 48
    ];
    const groups0 = groupBySortY(cells, squareGrid, 0, 0);
    const groups10 = groupBySortY(cells, squareGrid, 10, 0);

    // With origin=10: sortY = 0 + 16 + 10 = 26, 0 + 48 + 10 = 58
    expect(groups0[0]!.sortY).toBe(16);
    expect(groups0[1]!.sortY).toBe(48);
    expect(groups10[0]!.sortY).toBe(26);
    expect(groups10[1]!.sortY).toBe(58);
    // Groups still separated by same delta
    expect(groups10[1]!.sortY - groups10[0]!.sortY).toBe(32);
  });

  it('isometric grid produces correct sort order', () => {
    // Isometric STACKED, offsetAxis 0: x += 0.5 on odd rows, y *= 0.5, then (ret + 0.5) × {64, 32}.
    // cell(0,0): x=32, y=16. cell(1,0): x=96, y=16. cell(0,1): x=64, y=32.

    const cells = [
      cell({ x: 0, y: 0 }, 0, 0, 0),
      cell({ x: 1, y: 0 }, 0, 1, 0),
      cell({ x: 0, y: 1 }, 0, 0, 1),
    ];
    const groups = groupBySortY(cells, isoGrid, 0, 0);

    // sortY values: 16, 16, 32
    // Two groups: [cells at Y=16], [cell at Y=32]
    expect(groups.length).toBe(2);
    expect(groups[0]!.sortY).toBe(16);
    expect(groups[1]!.sortY).toBe(32);
    expect(groups[0]!.cells.length).toBe(2);
    expect(groups[1]!.cells.length).toBe(1);
  });

  it('layerWorldY shifts all groups uniformly', () => {
    const cells = [
      cell({ x: 0, y: 0 }, 0, 0, 0), // sortY = layerY + 16
      cell({ x: 0, y: 1 }, 0, 0, 1), // sortY = layerY + 48
    ];
    const groups0 = groupBySortY(cells, squareGrid, 0, 0);
    const groups100 = groupBySortY(cells, squareGrid, 0, 100);

    expect(groups0[0]!.sortY).toBe(16);
    expect(groups0[1]!.sortY).toBe(48);
    expect(groups100[0]!.sortY).toBe(116);
    expect(groups100[1]!.sortY).toBe(148);
  });

  it('empty cells returns empty groups', () => {
    const groups = groupBySortY([], squareGrid, 0, 0);
    expect(groups.length).toBe(0);
  });
});

describe("a tile's own y_sort_origin", () => {
  /** A cell whose tile sorts `ySortOrigin` px lower. */
  const lowered = (coords: { x: number; y: number }, ySortOrigin: number) =>
    drawableCellOf({ coords }, { ySortOrigin });
  const rows = (groups: ReturnType<typeof groupBySortY>) =>
    groups.map((group) => [group.sortY, group.cells.map((c) => c.coords.y)]);

  it('moves its cell to the row its sort Y names (tile_map_layer.cpp:547)', () => {
    // (0, 0) sorts at 16 + 40 = 56, below (0, 1) at 48.
    const groups = groupBySortY([lowered({ x: 0, y: 0 }, 40), cell({ x: 0, y: 1 })], squareGrid, 0, 0);
    expect(rows(groups)).toEqual([
      [48, [1]],
      [56, [0]],
    ]);
  });

  it('joins the row of another cell whose sort Y it lands on', () => {
    // (0, 0) sorts at 16 + 32 = 48, as (1, 1) does.
    const groups = groupBySortY([lowered({ x: 0, y: 0 }, 32), cell({ x: 1, y: 1 })], squareGrid, 0, 0);
    expect(rows(groups)).toEqual([[48, [0, 1]]]);
  });
});
