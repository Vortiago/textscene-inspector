/**
 * The quads of a BMFont run. The glyph rectangle, its draw origin and its subpixel shift follow
 * `font_draw_glyph` (`modules/text_server_adv/text_server_adv.cpp:4072-4108`).
 */
import { describe, expect, it } from 'vitest';
import { AutowrapMode, FixedSizeScaleMode } from '../../../../godot/text/textServerEnums';
import { testBitmapFont, testBitmapMetrics } from './bitmapFontMetrics.testkit';
import { buildBitmapQuads, type BitmapPaintOptions } from './bitmapTextPainter';
import { shapeText } from './textLayout';

function quadsFor(text: string, fontSizePx: number, scaleMode?: number, paint?: BitmapPaintOptions) {
  const fontMetrics = testBitmapMetrics(scaleMode);
  const layout = shapeText(text, {
    fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 3,
    fontMetrics,
  });
  return buildBitmapQuads(layout, fontMetrics, fontSizePx, fontMetrics.bitmap.sheet, paint);
}

/** The left, top, right and bottom of quad `index`, in Godot px with Y down. */
function rectOf(positions: Float32Array, index: number): [number, number, number, number] {
  const at = index * 12;
  return [positions[at]!, -positions[at + 1]!, positions[at + 3]!, -positions[at + 7]!];
}

describe('the sheets of a font', () => {
  it('holds the outline fills apart from the glyph fills, so an outline pass draws from them', () => {
    const outlineFill = { width: 2, height: 2, data: new Uint8Array(2 * 2 * 4).fill(9) };
    const font = testBitmapFont(undefined, [outlineFill]);

    expect([...font.outlineSheet.data.slice(0, 4)]).toEqual([9, 9, 9, 9]);
    expect([...font.sheet.data.slice(0, 4)]).toEqual([255, 255, 255, 255]);
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

  it('floors the pen at its canvas position, so a run at x 0.5 draws half a pixel left of its origin', () => {
    // text_server_adv.cpp:4082-4085 floors `p_pos`, which is the canvas position, at scale 1.
    const { positions } = quadsFor('H', 16, undefined, { originPhasePx: { x: 0.5, y: 0 } });

    expect(rectOf(positions, 0)[0]).toBe(0.5);
  });

  it('floors the baseline at its canvas position, so a run at y 0.5 draws half a pixel above its origin', () => {
    // text_server_adv.cpp:4083 floors `cpos.y` as it floors `cpos.x`.
    const { positions } = quadsFor('H', 16, undefined, { originPhasePx: { x: 0, y: 0.5 } });

    expect(rectOf(positions, 0)[1]).toBe(3.5);
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

describe('buildBitmapQuads for a Label3D', () => {
  const label3D: BitmapPaintOptions = { glyphDrawer: 'label3D' };

  it('skips a glyph whose rectangle is 2 px wide, and still advances the pen past it', () => {
    // `label_3d.cpp:357-360`: i is 2 x 12, so H and A draw, and A sits after the advances 10 and 4.
    const { positions } = quadsFor('HiA', 16, undefined, label3D);

    expect(positions.length / 12).toBe(2);
    expect(rectOf(positions, 1)[0]).toBe(14);
  });

  it('keeps the pen and the baseline, as its mesh floors neither (`label_3d.cpp:347`)', () => {
    const { positions } = quadsFor('H', 16, undefined, { ...label3D, originPhasePx: { x: 0.5, y: 0.5 } });

    expect(rectOf(positions, 0).slice(0, 2)).toEqual([1, 4]);
  });
});

describe('buildBitmapQuads over an outline sheet', () => {
  it('draws no quad for a font with no outline fills', () => {
    const fontMetrics = testBitmapMetrics();
    const layout = shapeText('Hi', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      lineSpacingPx: 3,
      fontMetrics,
    });

    expect(buildBitmapQuads(layout, fontMetrics, 16, fontMetrics.bitmap.outlineSheet).indices).toHaveLength(
      0
    );
  });
});
