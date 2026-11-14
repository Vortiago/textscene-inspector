import { describe, expect, it } from 'vitest';
import { ContourPointTag } from '../../../../../godot/text/textServerEnums';
import { AutowrapMode } from '../../../../../godot/text/textServerEnums';
import { TRIANGLE_CONTOURS } from '../../testing/triangleOutlines';
import { canvasGlyphRects, computeCanvasTextCanvasLayout, paintSceneFontCanvas } from '../canvasTextPainter';
import { withVariation } from '../fontMetrics';
import type { GlyphContours } from '../glyphContours';
import type { GlyphDrawer } from '../glyphDrawer';
import { createRuntimeFontMetrics } from '../runtimeFontMetrics';
import type { SfntOutlines } from '../sfntOutlines';
import { shapeText } from '../textLayout';
import type { BgraColour } from './cpal';

/** A square 4 px a side on the baseline, from the pen, which covers each pixel in it whole. */
const SQUARE: GlyphContours = {
  points: [
    { x: 0, y: 0, tag: ContourPointTag.ON },
    { x: 0, y: -4, tag: ContourPointTag.ON },
    { x: 4, y: -4, tag: ContourPointTag.ON },
    { x: 4, y: 0, tag: ContourPointTag.ON },
  ],
  contourEnds: [3],
  isFillRight: true,
};

const COLOUR_GLYPH = 7;
const LAYER_GLYPH = 8;
const PLAIN_GLYPH = 9;
const ORANGE: BgraColour = [0, 128, 255, 255];

/**
 * Outlines whose `A` is a colour glyph of one orange square layer, over a triangle of its own,
 * and whose `b` is a plain triangle.
 */
const COLOUR_OUTLINES: SfntOutlines = {
  glyphIndex: (codePoint) => (codePoint === 0x41 ? COLOUR_GLYPH : PLAIN_GLYPH),
  glyphContours: (glyph) => (glyph === LAYER_GLYPH ? SQUARE : TRIANGLE_CONTOURS),
  colourLayers: (glyph) => (glyph === COLOUR_GLYPH ? [{ glyph: LAYER_GLYPH, colour: ORANGE }] : null),
};

const FACE = withVariation(
  createRuntimeFontMetrics({
    hasGlyph: () => true,
    scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
    measureWidthUnits: (text) => text.length * 500,
    cssFontFamily: 'colour-glyph-test',
  }),
  { outlines: COLOUR_OUTLINES }
);

const TEAL = { r: 0, g: 0.5, b: 0.5, a: 1 };

function layoutFor(text: string) {
  return shapeText(text, {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    fontMetrics: FACE,
    lineSpacingPx: 0,
  });
}

interface PaintOptions {
  strokeWidthPx?: number;
  colourGlyphTint?: { r: number; g: number; b: number };
  glyphDrawer?: GlyphDrawer;
}

function paint(text: string, options: PaintOptions = {}): ImageData {
  const layout = layoutFor(text);
  const canvasLayout = computeCanvasTextCanvasLayout(layout, 0, options.strokeWidthPx ?? 0);
  return paintSceneFontCanvas(layout, 16, TEAL, 0, canvasLayout, options)!;
}

/** The red, green and blue of every pixel at alpha 255, once each. */
function opaqueColours(raster: ImageData): string[] {
  const colours = new Set<string>();
  for (let at = 0; at < raster.data.length; at += 4) {
    if (raster.data[at + 3] === 255) colours.add([...raster.data.subarray(at, at + 3)].join(','));
  }
  return [...colours];
}

function opaquePixelCount(raster: ImageData): number {
  let count = 0;
  for (let at = 3; at < raster.data.length; at += 4) if (raster.data[at] === 255) count++;
  return count;
}

describe('a COLR colour glyph in the canvas paint', () => {
  it('paints the colour of its layer, not the font colour', () => {
    expect(opaqueColours(paint('A'))).toEqual(['255,128,0']);
  });

  it('paints each pixel its layer covers, and not its own outline', () => {
    expect(opaquePixelCount(paint('A'))).toBe(16);
  });

  it('multiplies its colour by the tint a colour glyph takes', () => {
    expect(opaqueColours(paint('A', { colourGlyphTint: { r: 1, g: 0.5, b: 0 } }))).toEqual(['255,64,0']);
  });

  // A shader multiplies the texel by the modulate unclamped, and the target clamps the product.
  it('multiplies its colour by a tint over 1 before it clamps the product', () => {
    expect(opaqueColours(paint('A', { colourGlyphTint: { r: 2, g: 1.5, b: 0 } }))).toEqual(['255,192,0']);
  });

  it('leaves a plain glyph of the same run in the font colour', () => {
    const colours = opaqueColours(paint('Ab'));

    expect(colours).toContain('0,128,128');
    expect(colours).toContain('255,128,0');
  });

  it('strokes its own outline in the outline pass, which loads no colour', () => {
    const raster = paint('A', { strokeWidthPx: 2 });

    expect(opaqueColours(raster)).toEqual(['0,128,128']);
  });

  it('draws its quad over its layer bitmap and a margin of one texel', () => {
    const layout = layoutFor('A');
    const canvasLayout = computeCanvasTextCanvasLayout(layout, 0);

    const [rect] = canvasGlyphRects(layout, 16, 0, canvasLayout);

    expect([rect!.w, rect!.h]).toEqual([6, 6]);
  });

  it('keeps the font colour under alpha 0, as a raster of plain glyphs does', () => {
    const raster = paint('A');

    expect([...raster.data.subarray(0, 4)]).toEqual([0, 128, 128, 0]);
  });
});
