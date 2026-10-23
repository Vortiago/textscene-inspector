import { describe, expect, it } from 'vitest';
import { fitDecalAtlas, packDecalAtlas } from './decalAtlasLayout';

/*
 * Every expectation follows `update_decal_atlas` (`texture_storage.cpp:3038-3153`): border = 1 << 5
 * = 32, a cell is `(size / 32) + 1` with integer division, the base width starts at 8 cells, the
 * atlas is `base * 32` wide and `nearest_power_of_2(rows * 32)` tall, and a rectangle starts at
 * `cell * 32 + 16`.
 */

describe('packDecalAtlas', () => {
  it('is 32 x 32 with no texture (:3144-3153)', () => {
    expect(packDecalAtlas([])).toEqual({ width: 32, height: 32, rects: [] });
  });

  it('lays one 64 x 64 texture in a 256 x 128 atlas', () => {
    // Cell: 64 / 32 + 1 = 3 by 3. Base 8 cells, so 8 * 32 = 256 wide. Three rows: nearest_power_of_2(3 * 32 = 96) = 128 tall.
    // Rectangle: cell 0 * 32 + 16 = 16, at the texture's own 64 x 64.
    expect(packDecalAtlas([{ width: 64, height: 64 }])).toEqual({
      width: 256,
      height: 128,
      rects: [{ x: 16, y: 16, width: 64, height: 64 }],
    });
  });

  it('puts a shorter texture beside a taller one in the lowest span', () => {
    // 64 x 64 is 3 x 3 cells and 128 x 32 is 5 x 2. The taller sorts first and takes cells 0 to 2.
    // The wide one needs five columns: spans 0 to 2 stand at 3, so the first span of height 0 starts at cell 3.
    // Its rectangle starts at 3 * 32 + 16 = 112. Base 8 cells, 3 rows: 256 x 128.
    expect(
      packDecalAtlas([
        { width: 128, height: 32 },
        { width: 64, height: 64 },
      ])
    ).toEqual({
      width: 256,
      height: 128,
      rects: [
        { x: 112, y: 16, width: 128, height: 32 },
        { x: 16, y: 16, width: 64, height: 64 },
      ],
    });
  });

  it('keeps equal sizes in the order they joined', () => {
    // Two 3 x 3 cells: the first at cell 0, the second at the first span of height 0, cell 3 (3 * 32 + 16 = 112).
    const rects = packDecalAtlas([
      { width: 64, height: 64 },
      { width: 64, height: 64 },
    ]).rects;
    expect(rects.map((rect) => rect.x)).toEqual([16, 112]);
  });

  it('grows the base width for a texture wider than 256 pixels', () => {
    // 300 / 32 + 1 = 10 cells wide, past the base of 8, so the base is nearest_power_of_2(10) = 16:
    // 16 * 32 = 512 wide. 100 / 32 + 1 = 4 rows: nearest_power_of_2(4 * 32 = 128) = 128 tall.
    expect(packDecalAtlas([{ width: 300, height: 100 }])).toEqual({
      width: 512,
      height: 128,
      rects: [{ x: 16, y: 16, width: 300, height: 100 }],
    });
  });

  it('doubles the width until the height is at most twice the width (:3135-3140)', () => {
    // 64 x 640 is 3 x 21 cells. Base 8: 21 rows > 2 * 8, so 16: 21 <= 32. Width 16 * 32 = 512,
    // height nearest_power_of_2(21 * 32 = 672) = 1024.
    expect(packDecalAtlas([{ width: 64, height: 640 }])).toMatchObject({ width: 512, height: 1024 });
  });
});

describe('fitDecalAtlas', () => {
  const sizes = [
    { width: 300, height: 100 },
    { width: 64, height: 64 },
  ];

  it('packs everything when the atlas fits the limit', () => {
    expect(fitDecalAtlas(sizes, 4096)).toEqual({ layout: packDecalAtlas(sizes), wanted: undefined });
  });

  it('drops the textures that joined last until the rest fit, and names the size it wanted', () => {
    const { layout, wanted } = fitDecalAtlas(sizes, 256);
    const full = packDecalAtlas(sizes);
    expect(wanted).toEqual({ width: full.width, height: full.height });
    // The 300-wide texture alone needs 512 wide, so nothing fits in 256.
    expect(layout).toEqual({ width: 32, height: 32, rects: [] });
  });

  it('keeps the earlier textures when only a later one overflows', () => {
    const later = [
      { width: 64, height: 64 },
      { width: 300, height: 100 },
    ];
    const { layout } = fitDecalAtlas(later, 256);
    expect(layout.rects).toEqual([{ x: 16, y: 16, width: 64, height: 64 }]);
  });
});
