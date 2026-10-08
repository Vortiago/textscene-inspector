/**
 * A rendering quadrant draws its cells in one sorted order whatever their atlas source, so its
 * batches are the runs of consecutive cells that share a source.
 */
import { describe, expect, it } from 'vitest';
import { sourceRuns } from './sourceRuns';
import type { PlacedCell } from '../nodes/2d/tiles/shared/tileData';
import type { AtlasSourceModel } from '../resources/tileset/types';

function atlasSource(id: number): AtlasSourceModel {
  return {
    texturePath: `res://source${id}.png`,
    margins: { x: 0, y: 0 },
    separation: { x: 0, y: 0 },
    textureRegionSize: { x: 16, y: 16 },
    tiles: new Map(),
  };
}

/** A tileset that defines `ids` as its atlas sources. */
function tileSet(ids: number[]) {
  return { sources: new Map(ids.map((id) => [id, atlasSource(id)])) };
}

function cell(sourceId: number, x: number): PlacedCell {
  return { coords: { x, y: 0 }, sourceId, atlasCoords: { x: 0, y: 0 }, alternativeId: 0 };
}

const runIds = (runs: ReturnType<typeof sourceRuns>) =>
  runs.map((run) => [run.sourceId, run.cells.map((c) => c.coords.x)]);

describe('sourceRuns', () => {
  it('starts a new batch at each change of source, keeping the cell order', () => {
    const runs = sourceRuns(tileSet([0, 1]), [cell(0, 0), cell(1, 1), cell(0, 2), cell(0, 3)]);
    expect(runIds(runs)).toEqual([
      [0, [0]],
      [1, [1]],
      [0, [2, 3]],
    ]);
  });

  it("hands each batch its source's atlas", () => {
    const model = tileSet([4]);
    expect(sourceRuns(model, [cell(4, 0)])[0]!.source).toBe(model.sources.get(4));
  });

  it('drops a cell naming a source the tileset does not define, joining the runs around it', () => {
    // Letting it through would hand TileSourceMesh an undefined atlas.
    const runs = sourceRuns(tileSet([1]), [cell(1, 0), cell(9, 1), cell(1, 2)]);
    expect(runIds(runs)).toEqual([[1, [0, 2]]]);
  });

  it('returns no batch for no cells', () => {
    expect(sourceRuns(tileSet([1]), [])).toEqual([]);
  });
});
