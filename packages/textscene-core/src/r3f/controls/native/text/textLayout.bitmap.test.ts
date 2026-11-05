/**
 * Shaping against a BMFont. The expected numbers are the descriptor's own (`descriptor.testkit.ts`)
 * scaled as Godot scales a fixed-size font (`text_server_adv.cpp:2907-2912,3052-3057,7011`), and the
 * glyph positions of `Hi AV Hi` match the ink measured in Godot 4.6.3 (`pnpm ref:godot`).
 */
import { describe, expect, it } from 'vitest';
import { FixedSizeScaleMode } from '../../../../godot/text/textServerEnums';
import { AutowrapMode } from '../../../../godot/text/textServerEnums';
import { testBitmapMetrics } from './bitmapFontMetrics.testkit';
import { shapeText } from './textLayout';

function shape(text: string, fontSizePx: number, scaleMode?: number) {
  const fontMetrics = testBitmapMetrics(scaleMode);
  return shapeText(text, {
    fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    lineSpacingPx: 3,
    fontMetrics,
  });
}

const penXs = (text: string, fontSizePx: number, scaleMode?: number): number[] =>
  shape(text, fontSizePx, scaleMode).lines[0]!.glyphs.map((glyph) => glyph.x);

describe('shapeText over a BMFont', () => {
  it('places the glyphs at the descriptor advances at the fixed size, with the kerning pair', () => {
    // H 10, i 4, space 5, A 9 less 3 for `A V`, V 9, space 5, H 10, i 4.
    expect(penXs('Hi AV Hi', 16).slice(0, 8)).toEqual([0, 10, 14, 19, 25, 34, 39, 49]);
  });

  it('scales the advance and the kerning by size over fixed size under the enabled mode', () => {
    expect(penXs('Hi AV Hi', 32).slice(0, 8)).toEqual([0, 20, 28, 38, 50, 68, 78, 98]);
    expect(penXs('Hi AV Hi', 24).slice(0, 8)).toEqual([0, 15, 21, 28.5, 37.5, 51, 58.5, 73.5]);
  });

  it('scales by the rounded ratio under the integer-only mode', () => {
    // round(24 / 16) is 2, so a glyph advances as at 32.
    expect(penXs('Hi AV Hi', 24, FixedSizeScaleMode.FIXED_SIZE_SCALE_INTEGER_ONLY).slice(0, 8)).toEqual([
      0, 20, 28, 38, 50, 68, 78, 98,
    ]);
  });

  it('keeps the fixed size under the disabled mode', () => {
    expect(penXs('Hi AV Hi', 24, FixedSizeScaleMode.FIXED_SIZE_SCALE_DISABLE).slice(0, 8)).toEqual(
      penXs('Hi AV Hi', 16).slice(0, 8)
    );
  });

  it('puts the baseline at the scaled ascent and the pitch at the scaled height plus the spacing', () => {
    const layout = shape('H', 24);

    expect(layout.baselineOffsetPx).toBe(24);
    expect(layout.linePitchPx).toBe(30 + 3);
  });

  it('measures the line from the unrounded advances', () => {
    expect(shape('Hi AV Hi', 24).widthPx).toBe(79.5);
  });

  it('draws a character the descriptor lacks as a hex-code box that advances by its width', () => {
    const [h, z] = shape('HzH', 16).lines[0]!.glyphs;

    expect(z!.x - h!.x).toBe(10);
    expect(z!.controlCodepoint).toBe(0x7a);
    expect(shape('HzH', 16).lines[0]!.glyphs[2]!.x).toBe(10 + 8);
  });
});
