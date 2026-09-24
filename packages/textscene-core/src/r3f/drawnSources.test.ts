/**
 * Each atlas source batches into one mesh ordered by `sourceIndex` within the layer. The index is
 * dense over the drawn sources, not the tileset's list, so it never runs past the batches emitted.
 */
import { describe, expect, it } from 'vitest';
import { drawnSources } from './drawnSources';
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

/** A tileset that defines `ids` as its atlas sources, in that order. */
function tileSet(ids: number[]) {
  return { sourceOrder: ids, sources: new Map(ids.map((id) => [id, atlasSource(id)])) };
}

function cell(sourceId: number, x: number): PlacedCell {
  return { coords: { x, y: 0 }, sourceId, atlasCoords: { x: 0, y: 0 }, alternativeId: 0 };
}

describe('drawnSources', () => {
  it('batches the cells per source, in the tileset order', () => {
    const model = tileSet([7, 3]);
    const drawn = drawnSources(model, [cell(3, 0), cell(7, 1), cell(3, 2)]);

    expect(drawn.map((e) => e.sourceId)).toEqual([7, 3]);
    expect(drawn[0]!.source).toBe(model.sources.get(7));
    expect(drawn[0]!.cells.map((c) => c.coords.x)).toEqual([1]);
    // Cell order within a source survives the bucketing: the geometry builder
    // emits quads in this order and equal-z quads resolve by emission order.
    expect(drawn[1]!.cells.map((c) => c.coords.x)).toEqual([0, 2]);
  });

  it('indexes over the DRAWN sources, not the tileset ones', () => {
    // The pairing this helper exists to make unrepresentable: a group that
    // draws two of the tileset's five sources must index 0..1 out of 2, not
    // carry the tileset-wide index 1/4 against a count of 2.
    const drawn = drawnSources(tileSet([1, 2, 3, 4, 5]), [cell(2, 0), cell(5, 1)]);

    expect(drawn.map((e) => e.sourceId)).toEqual([2, 5]);
    expect(drawn.map((e) => e.sourceIndex)).toEqual([0, 1]);
    expect(drawn.map((e) => e.sourceCount)).toEqual([2, 2]);
    for (const entry of drawn) expect(entry.sourceCount).toBe(drawn.length);
  });

  it('indexes densely from zero over the drawn sources, whatever ids the tileset uses', () => {
    // The batch order rides `sourceIndex` directly, so a sparse or tileset-wide
    // index would reach past the batches the layer actually emits.
    const drawn = drawnSources(tileSet([1, 2, 3, 4, 5]), [cell(4, 0), cell(5, 1)]);

    expect(drawn.map((d) => d.sourceIndex)).toEqual([0, 1]);
    for (const { sourceIndex, sourceCount } of drawn) {
      expect(sourceIndex).toBeGreaterThanOrEqual(0);
      expect(sourceIndex).toBeLessThan(sourceCount);
    }
  });

  it('drops sources the cells never paint', () => {
    const drawn = drawnSources(tileSet([1, 2, 3]), [cell(2, 0)]);
    expect(drawn.map((e) => e.sourceId)).toEqual([2]);
  });

  it('ignores cells naming a source the tileset does not define', () => {
    // Letting them through would hand TileSourceMesh an undefined atlas.
    const drawn = drawnSources(tileSet([1]), [cell(9, 0), cell(1, 1)]);
    expect(drawn.map((e) => e.sourceId)).toEqual([1]);
    expect(drawn[0]!.cells).toHaveLength(1);
  });

  it('returns nothing for an empty cell list', () => {
    expect(drawnSources(tileSet([1, 2]), [])).toEqual([]);
  });

  it('returns nothing for a tileset with no sources', () => {
    expect(drawnSources(tileSet([]), [cell(1, 0)])).toEqual([]);
  });
});
