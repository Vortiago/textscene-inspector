/**
 * The quads of a BMFont run. The glyph rectangle, its draw origin and its subpixel shift follow
 * `font_draw_glyph` (`modules/text_server_adv/text_server_adv.cpp:4072-4108`).
 */
import { describe, expect, it } from 'vitest';
import { AutowrapMode, FixedSizeScaleMode } from '../../../../godot/text/textServerEnums';
import { testBitmapFont, testBitmapMetrics } from './bitmapFontMetrics.testkit';
import { buildBitmapQuads, sheetOf } from './bitmapTextPainter';
import { shapeText } from './textLayout';

function quadsFor(text: string, fontSizePx: number, scaleMode?: number) {
  const fontMetrics = testBitmapMetrics(scaleMode);
  const layout = shapeText(text, {
    fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 3,
    fontMetrics,
  });
  return buildBitmapQuads(layout, fontMetrics.bitmap, fontSizePx);
}

/** The left, top, right and bottom of quad `index`, in Godot px with Y down. */
function rectOf(positions: Float32Array, index: number): [number, number, number, number] {
  const at = index * 12;
  return [positions[at]!, -positions[at + 1]!, positions[at + 3]!, -positions[at + 7]!];
}

describe('sheetOf', () => {
  const sheet = sheetOf({
    ...testBitmapFont(),
    fills: [
      { width: 4, height: 2, data: new Uint8Array(4 * 2 * 4).fill(1) },
      undefined,
      { width: 2, height: 3, data: new Uint8Array(2 * 3 * 4).fill(2) },
    ],
  });
  const texel = (x: number, row: number): number[] => [
    ...sheet.data.slice((row * sheet.width + x) * 4, (row * sheet.width + x) * 4 + 4),
  ];

  it('keeps a finite width when a page id skips an index', () => {
    const sparse = sheetOf({
      ...testBitmapFont(),
      fills: [undefined, { width: 3, height: 1, data: new Uint8Array(12) }],
    });

    expect(sparse.width).toBe(3);
  });

  it('stacks the fills top to bottom in one sheet as wide as the widest', () => {
    expect([sheet.width, sheet.height]).toEqual([4, 5]);
    expect(sheet.rowOffsets).toEqual([0, undefined, 2]);
    expect(texel(3, 1)).toEqual([1, 1, 1, 1]);
    expect(texel(1, 2)).toEqual([2, 2, 2, 2]);
  });

  it('leaves the width a narrower fill does not cover clear', () => {
    expect(texel(2, 3)).toEqual([0, 0, 0, 0]);
  });
});

describe('buildBitmapQuads', () => {
  it('draws the glyphs that have ink at their offset from the baseline, whole pixels at the fixed size', () => {
    // `Hi`: H at x 1 (xoffset), top 16 - 12 = 4 below the line top; i after the advance 10.
    const { positions } = quadsFor('Hi', 16);

    expect(rectOf(positions, 0)).toEqual([1, 4, 9, 16]);
    expect(rectOf(positions, 1)).toEqual([11, 4, 13, 16]);
  });

  it('scales the rectangle and the offset by size over fixed size, and keeps the pen fractional', () => {
    const { positions } = quadsFor('Hi', 24);

    // The baseline is 16 * 1.5 = 24 down, the offset -12 * 1.5 = -18 from it.
    expect(rectOf(positions, 0)).toEqual([1.5, 6, 1.5 + 12, 24]);
    expect(rectOf(positions, 1)).toEqual([15 + 1.5, 6, 15 + 1.5 + 3, 24]);
  });

  it('draws no quad for a space, whose rectangle is empty', () => {
    expect(quadsFor(' ', 16).indices.length).toBe(0);
  });

  it('does not scale the rectangle under the disabled mode', () => {
    const { positions } = quadsFor('H', 24, FixedSizeScaleMode.FIXED_SIZE_SCALE_DISABLE);

    expect(rectOf(positions, 0)).toEqual([1, 4, 9, 16]);
  });

  it('points each quad at its glyph rectangle of the sheet', () => {
    const { uvs } = quadsFor('i', 16);

    // Fill 0 is 64 x 32: i is x 8, y 0, 2 x 12.
    expect([uvs[0], uvs[1], uvs[2], uvs[5]]).toEqual([8 / 64, 0, 10 / 64, 12 / 32]);
  });
});
