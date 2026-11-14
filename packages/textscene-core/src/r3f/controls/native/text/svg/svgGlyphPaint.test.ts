import { describe, expect, it } from 'vitest';
import { AutowrapMode } from '../../../../../godot/text/textServerEnums';
import { TRIANGLE_CONTOURS } from '../../testing/triangleOutlines';
import type { ColourBitmap } from '../colour/colourBitmap';
import { computeCanvasTextCanvasLayout, paintSceneFontCanvas } from '../canvasTextPainter';
import { withVariation } from '../fontMetrics';
import { createRuntimeFontMetrics } from '../runtimeFontMetrics';
import type { SfntOutlines } from '../sfntOutlines';
import type { FaceStrikes } from '../strike/faceStrikes';
import type { SbitStrike } from '../strike/sbitStrikes';
import { strikeSizeAt } from '../strike/strikeSize';
import { shapeText } from '../textLayout';
import type { SvgGlyphs } from './svgGlyphs';

const SVG_GLYPH = 7;
const FAILING_GLYPH = 8;
const OUTLINE_GLYPH = 9;

/** An opaque 2 × 2 bitmap of `[r, g, b]` from the pen, 2 px above the baseline. */
function squareBitmap([r, g, b]: readonly number[]): ColourBitmap {
  const texels = new Uint8Array(16);
  for (let at = 0; at < 16; at += 4) texels.set([r!, g!, b!, 255], at);
  return { grid: { left: 0, top: -2, width: 2, height: 2 }, texels };
}

/** SVG glyphs that draw `SVG_GLYPH` green, fail to draw `FAILING_GLYPH`, and hold no other document. */
const SVG_GLYPHS: SvgGlyphs = {
  sizeAt: (fontSizePx) => ({ xPpem: fontSizePx, yPpem: fontSizePx, ascender: 0, descender: 0, xScale: 0 }),
  readerAt: () => (glyph) => {
    if (glyph === SVG_GLYPH) return squareBitmap([0, 255, 0]);
    return glyph === FAILING_GLYPH ? null : undefined;
  },
  subscribe: () => () => undefined,
  version: 0,
};

const SCALE_AT_20_PPEM = Math.round((20 * 64 * 65536) / 1000);
const STRIKE: SbitStrike = {
  tableIndex: 0,
  width: 20,
  metrics: {
    xPpem: 20,
    yPpem: 20,
    ascender: 18 * 64,
    descender: -5 * 64,
    xScale: SCALE_AT_20_PPEM,
    yScale: SCALE_AT_20_PPEM,
  },
};

/** A scalable strike that draws `SVG_GLYPH` blue. */
const BLUE_STRIKE: FaceStrikes = {
  sizeAt: (fontSizePx) => strikeSizeAt([STRIKE], fontSizePx, null),
  bitmapOf: (_strike, glyph) =>
    glyph === SVG_GLYPH
      ? {
          pixelMode: 'bgra',
          width: 2,
          rows: 2,
          pitch: 8,
          buffer: new Uint8Array([255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255]),
          left: 0,
          top: 2,
        }
      : null,
  isScalable: true,
};

/** Each character's glyph: `A` the SVG glyph, `F` the one that fails, any other one with no document. */
function glyphOfChar(codePoint: number): number {
  if (codePoint === 0x41) return SVG_GLYPH;
  return codePoint === 0x46 ? FAILING_GLYPH : OUTLINE_GLYPH;
}

function svgFace(extra: Partial<SfntOutlines> = {}) {
  const outlines: SfntOutlines = {
    glyphIndex: glyphOfChar,
    glyphContours: () => TRIANGLE_CONTOURS,
    svgGlyphs: SVG_GLYPHS,
    ...extra,
  };
  return withVariation(
    createRuntimeFontMetrics({
      hasGlyph: () => true,
      scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
      measureWidthUnits: (text) => text.length * 500,
      cssFontFamily: 'svg-glyph-test',
    }),
    { outlines }
  );
}

const TEAL = { r: 0, g: 0.5, b: 0.5, a: 1 };

function paint(text: string, face: ReturnType<typeof svgFace>, strokeWidthPx = 0): ImageData {
  const fontSizePx = 20;
  const layout = shapeText(text, {
    fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    fontMetrics: face,
    lineSpacingPx: 0,
  });
  const canvasLayout = computeCanvasTextCanvasLayout(layout, 0, strokeWidthPx);
  return paintSceneFontCanvas(layout, fontSizePx, TEAL, 0, canvasLayout, { strokeWidthPx })!;
}

/** The red, green and blue of every pixel at alpha 255, once each. */
function opaqueColours(raster: ImageData): string[] {
  const colours = new Set<string>();
  for (let at = 0; at < raster.data.length; at += 4) {
    if (raster.data[at + 3] === 255) colours.add([...raster.data.subarray(at, at + 3)].join(','));
  }
  return [...colours];
}

function inkedPixelCount(raster: ImageData): number {
  let count = 0;
  for (let at = 3; at < raster.data.length; at += 4) if (raster.data[at]! > 0) count++;
  return count;
}

describe('an SVG glyph in the canvas paint', () => {
  it('paints its bitmap in its own colour', () => {
    const raster = paint('A', svgFace());
    expect(opaqueColours(raster)).toEqual(['0,255,0']);
    expect(inkedPixelCount(raster)).toBe(4);
  });

  it('draws nothing where the hook draws nothing', () => {
    expect(inkedPixelCount(paint('F', svgFace()))).toBe(0);
  });

  it('draws the outline of a glyph with no document', () => {
    expect(opaqueColours(paint('b', svgFace()))).toEqual(['0,128,128']);
  });

  it('strokes the outline in the outline pass, which loads no SVG', () => {
    expect(opaqueColours(paint('A', svgFace(), 2))).not.toContain('0,255,0');
    expect(inkedPixelCount(paint('A', svgFace(), 2))).toBeGreaterThan(0);
  });

  it('comes before the COLR layers of the glyph', () => {
    const colourLayers = () => [{ glyph: OUTLINE_GLYPH, colour: [0, 0, 255, 255] as const }];
    expect(opaqueColours(paint('A', svgFace({ colourLayers })))).toEqual(['0,255,0']);
  });

  it('comes after the strike bitmap of the glyph, as the driver loads it', () => {
    expect(opaqueColours(paint('A', svgFace({ strikes: BLUE_STRIKE })))).toEqual(['0,0,255']);
  });

  it('comes before the strike bitmap of the glyph under the auto-hinter', () => {
    const face = svgFace({ strikes: BLUE_STRIKE, loadsSvgBeforeStrike: true });
    expect(opaqueColours(paint('A', face))).toEqual(['0,255,0']);
  });
});
