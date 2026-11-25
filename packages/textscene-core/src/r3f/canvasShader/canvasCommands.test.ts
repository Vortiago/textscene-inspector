import { describe, expect, it } from 'vitest';
import { atlasRectRegion } from './canvasCommands';

/** A 16 by 8 cell at (32, 16) of its atlas, with a 2 px margin left and top around a 14 by 6 region. */
const CELL = {
  sheetSize: { width: 64, height: 64 },
  cell: { x: 32, y: 16, w: 16, h: 8 },
  region: { x: 2, y: 2, w: 14, h: 6 },
  filterClip: true,
};

describe('atlasRectRegion', () => {
  it('reads the cell in the atlas, and draws only the region past the margin', () => {
    const region = {
      rect: { x: -8, y: -4, w: 16, h: 8 },
      source: { x: 0, y: 0, w: 16, h: 8 },
      clipUv: false,
    };

    expect(atlasRectRegion(region, CELL)).toEqual({
      rect: { x: -6, y: -2, w: 14, h: 6 },
      source: { x: 34, y: 18, w: 14, h: 6 },
      clipUv: true,
    });
  });

  it('keeps the margin on the far side of a flipped rect', () => {
    const region = {
      rect: { x: 8, y: -4, w: -16, h: 8 },
      source: { x: 0, y: 0, w: 16, h: 8 },
      clipUv: false,
    };

    expect(atlasRectRegion(region, CELL)?.rect).toEqual({ x: 8, y: -2, w: -14, h: 6 });
  });

  it('scales with the rect, as a magnified sprite does', () => {
    const region = { rect: { x: 0, y: 0, w: 32, h: 16 }, source: { x: 4, y: 0, w: 8, h: 8 }, clipUv: false };

    expect(atlasRectRegion(region, CELL)).toMatchObject({
      rect: { x: 0, y: 4, w: 32, h: 12 },
      source: { x: 36, y: 18, w: 8, h: 6 },
    });
  });

  it('draws nothing for a source wholly in the margin', () => {
    const region = { rect: { x: 0, y: 0, w: 2, h: 2 }, source: { x: 0, y: 0, w: 2, h: 2 }, clipUv: false };

    expect(atlasRectRegion(region, CELL)).toBeNull();
  });
});
