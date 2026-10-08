/**
 * A rendering quadrant is one or more canvas items: Godot starts a new one at each change of tile
 * material or `z_index` in the quadrant's cell order, and batches each item's cells into runs of
 * one atlas source.
 */
import { describe, expect, it } from 'vitest';
import { quadrantCanvasItems, type TileCanvasItem } from './tileCanvasItems';
import { drawableCellOf } from './testing/drawableCellOf';
import type { AlternativeTileModel, TileMaterial } from './types';
import type { DrawableCell } from './drawableCell';

const ADD: TileMaterial = { properties: null };
const SUB: TileMaterial = { properties: null };

function cell(x: number, tileData: Partial<AlternativeTileModel> = {}, sourceId = 0): DrawableCell {
  return drawableCellOf({ coords: { x, y: 0 }, sourceId }, tileData);
}

/** Each item's runs as [sourceId, cell x coords]. */
const runsOf = (items: readonly TileCanvasItem[]) =>
  items.map((item) => item.runs.map((run) => [run.sourceId, run.cells.map((c) => c.coords.x)]));

describe('quadrantCanvasItems', () => {
  it('draws a quadrant whose tiles share material and z_index as one canvas item', () => {
    expect(runsOf(quadrantCanvasItems([cell(0), cell(1)]))).toEqual([[[0, [0, 1]]]]);
  });

  it('starts a canvas item at each change of z_index, in cell order', () => {
    const items = quadrantCanvasItems([cell(0), cell(1, { zIndex: 2 }), cell(2)]);
    expect(items.map((item) => item.zIndex)).toEqual([0, 2, 0]);
    expect(runsOf(items)).toEqual([[[0, [0]]], [[0, [1]]], [[0, [2]]]]);
  });

  it('starts a canvas item at each change of material, and keeps one item for one shared material', () => {
    const items = quadrantCanvasItems([
      cell(0),
      cell(1, { material: ADD }),
      cell(2, { material: ADD }),
      cell(3, { material: SUB }),
    ]);
    expect(items.map((item) => item.material)).toEqual([null, ADD, SUB]);
    expect(runsOf(items)).toEqual([[[0, [0]]], [[0, [1, 2]]], [[0, [3]]]]);
  });

  it('starts a batch at each change of source inside one canvas item', () => {
    const items = quadrantCanvasItems([cell(0), cell(1, {}, 1), cell(2), cell(3)]);
    expect(runsOf(items)).toEqual([
      [
        [0, [0]],
        [1, [1]],
        [0, [2, 3]],
      ],
    ]);
  });

  it("hands each batch its cells' atlas source", () => {
    const placed = cell(0, {}, 4);
    expect(quadrantCanvasItems([placed])[0]!.runs[0]!.source).toBe(placed.source);
  });

  it('keeps a z_index the RenderingServer refuses at 0, though it still starts an item', () => {
    // `canvas_item_set_z_index` refuses one outside ±4096 (renderer_canvas_cull.cpp:1841).
    const items = quadrantCanvasItems([cell(0), cell(1, { zIndex: 5000 })]);
    expect(items.map((item) => item.zIndex)).toEqual([0, 0]);
  });

  it('returns no canvas item for no cells', () => {
    expect(quadrantCanvasItems([])).toEqual([]);
  });
});
