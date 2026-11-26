import { describe, expect, it } from 'vitest';
import { atlasCellsOf, type DirectionalShadowAtlasShare } from './directionalShadowDepth.js';

const share = (
  rect: DirectionalShadowAtlasShare['rect'],
  splitCount: number,
  depthScales: number[]
): DirectionalShadowAtlasShare => ({ rect, splitCount, depthScales });

describe('atlasCellsOf', () => {
  it("gives a light's four depth scales to its cell", () => {
    const cells = atlasCellsOf([share({ x: 0, y: 0, width: 4096, height: 4096 }, 4, [1.5, 2, 3, 4])]);
    expect([cells.columns, cells.rows, cells.splitCounts[0]]).toEqual([1, 1, 4]);
    expect(cells.depthScales.slice(0, 4)).toEqual([1.5, 2, 3, 4]);
  });

  it('puts the second of two lights in the right half, as Godot lays out two shares', () => {
    const cells = atlasCellsOf([
      share({ x: 0, y: 0, width: 2048, height: 4096 }, 2, [1.5, 2]),
      share({ x: 2048, y: 0, width: 2048, height: 4096 }, 1, [3]),
    ]);
    expect([cells.columns, cells.rows]).toEqual([2, 1]);
    expect(cells.splitCounts.slice(0, 2)).toEqual([2, 1]);
    expect(cells.depthScales.slice(0, 8)).toEqual([1.5, 2, 1, 1, 3, 1, 1, 1]);
  });

  it('counts the cells of a grid of three lights row by row', () => {
    const cells = atlasCellsOf([
      share({ x: 0, y: 0, width: 2048, height: 2048 }, 1, [2]),
      share({ x: 2048, y: 0, width: 2048, height: 2048 }, 1, [3]),
      share({ x: 0, y: 2048, width: 2048, height: 2048 }, 1, [4]),
    ]);
    expect([cells.columns, cells.rows]).toEqual([2, 2]);
    expect([0, 1, 2, 3].map((cell) => cells.depthScales[cell * 4])).toEqual([2, 3, 4, 1]);
  });

  it('leaves every cell empty with no shadowed light (edge case)', () => {
    const cells = atlasCellsOf([]);
    expect([cells.columns, cells.rows, Math.max(...cells.splitCounts)]).toEqual([1, 1, 0]);
  });
});
