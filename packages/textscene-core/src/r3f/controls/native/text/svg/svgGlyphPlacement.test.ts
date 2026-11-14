import { describe, expect, it } from 'vitest';
import { svgGlyphPlacement, type SvgGlyphSize } from './svgGlyphPlacement';

/** 20 ppem, the line 16 px above the baseline and 4 px below, in 26.6. */
const SIZE: SvgGlyphSize = { xPpem: 20, yPpem: 20, ascender: 16 * 64, descender: -4 * 64 };
const ADVANCE_20_PX = 20 * 64;
const EMBOX = { x: 1000, y: 1000 };

describe('svgGlyphPlacement', () => {
  it('draws the picture at the ppem over the em box, so a 100-unit picture is 2 px at 20 ppem', () => {
    const placement = svgGlyphPlacement({ width: 100, height: 100 }, EMBOX, SIZE, ADVANCE_20_PX);
    expect(placement).toMatchObject({ pictureWidth: 2, pictureHeight: 2, width: 2, rows: 2 });
  });

  it('keeps the aspect of a wide or a tall picture', () => {
    expect(svgGlyphPlacement({ width: 200, height: 100 }, EMBOX, SIZE, ADVANCE_20_PX)).toMatchObject({
      width: 4,
      rows: 2,
    });
    expect(svgGlyphPlacement({ width: 100, height: 300 }, EMBOX, SIZE, ADVANCE_20_PX)).toMatchObject({
      width: 2,
      rows: 6,
    });
  });

  it('centres the picture on the advance, its left edge cut to a whole pixel toward zero', () => {
    expect(svgGlyphPlacement({ width: 155, height: 100 }, EMBOX, SIZE, ADVANCE_20_PX)).toMatchObject({
      width: 4,
      left: 8,
    });
    expect(svgGlyphPlacement({ width: 1050, height: 100 }, EMBOX, SIZE, ADVANCE_20_PX)?.left).toBe(0);
  });

  it('raises the picture by its height times the line over the ascender, rounded up', () => {
    // 3 px tall, and (16 - 4) / 16 of it is 2.25: the top sits 3 px above the baseline.
    expect(svgGlyphPlacement({ width: 100, height: 150 }, EMBOX, SIZE, ADVANCE_20_PX)?.top).toBe(3);
  });

  it('scales by the em box width on both axes', () => {
    const placement = svgGlyphPlacement(
      { width: 100, height: 100 },
      { x: 500, y: 2000 },
      SIZE,
      ADVANCE_20_PX
    );
    expect([placement?.width, placement?.rows]).toEqual([4, 4]);
  });

  it('has no placement for a picture of no area', () => {
    expect(svgGlyphPlacement({ width: 0, height: 100 }, EMBOX, SIZE, ADVANCE_20_PX)).toBeNull();
  });
});
