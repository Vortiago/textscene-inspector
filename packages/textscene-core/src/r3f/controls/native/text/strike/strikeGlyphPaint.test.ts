import { describe, expect, it } from 'vitest';
import { AutowrapMode } from '../../../../../godot/text/textServerEnums';
import { TRIANGLE_CONTOURS } from '../../testing/triangleOutlines';
import { canvasGlyphRects, computeCanvasTextCanvasLayout, paintSceneFontCanvas } from '../canvasTextPainter';
import { getFontAscentPx, getFontLinePitchPx, getFontRunGlyphAdvancePx, withVariation } from '../fontMetrics';
import { createRuntimeFontMetrics } from '../runtimeFontMetrics';
import type { SfntOutlines } from '../sfntOutlines';
import { shapeText } from '../textLayout';
import type { FaceStrikes } from './faceStrikes';
import type { SbitStrike } from './sbitStrikes';
import type { StrikeBitmap, StrikePixelMode } from './strikeBitmap';
import { strikeSizeAt } from './strikeSize';

const STRIKE_GLYPH = 7;
const OUTLINE_GLYPH = 9;

/** One strike 20 px wide, its line 18 px above the baseline and 5 px below. */
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

/** A 2 × 2 bitmap of `pixelMode` from the pen, 2 px above the baseline: opaque red in BGRA, full coverage else. */
function squareBitmap(pixelMode: StrikePixelMode): StrikeBitmap {
  const bytes: Record<StrikePixelMode, number[]> = {
    bgra: [0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255, 255],
    gray: [255, 255, 255, 255],
    mono: [0b11000000, 0b11000000],
    gray2: [0b11110000, 0b11110000],
    gray4: [0xff, 0xff],
  };
  const pitch = { bgra: 8, gray: 2, mono: 1, gray2: 1, gray4: 1 }[pixelMode];
  return { pixelMode, width: 2, rows: 2, pitch, buffer: new Uint8Array(bytes[pixelMode]), left: 0, top: 2 };
}

/** A face whose `A` is a strike glyph of `pixelMode` and whose `b` the strike lacks, each with a triangle outline. */
function strikeFace({
  pixelMode = 'bgra',
  isScalable = false,
}: { pixelMode?: StrikePixelMode; isScalable?: boolean } = {}) {
  const strikes: FaceStrikes = {
    sizeAt: (fontSizePx) => strikeSizeAt([STRIKE], fontSizePx, null),
    bitmapOf: (_strike, glyph) => (glyph === STRIKE_GLYPH ? squareBitmap(pixelMode) : null),
    isScalable,
  };
  const outlines: SfntOutlines = {
    glyphIndex: (codePoint) => (codePoint === 0x41 ? STRIKE_GLYPH : OUTLINE_GLYPH),
    glyphContours: () => TRIANGLE_CONTOURS,
    strikes,
  };
  return withVariation(
    createRuntimeFontMetrics({
      hasGlyph: () => true,
      scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
      measureWidthUnits: (text) => text.length * 500,
      cssFontFamily: 'strike-glyph-test',
    }),
    { outlines }
  );
}

type StrikeFace = ReturnType<typeof strikeFace>;

const TEAL = { r: 0, g: 0.5, b: 0.5, a: 1 };

function layoutFor(text: string, face: StrikeFace, fontSizePx: number) {
  return shapeText(text, {
    fontSizePx,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    fontMetrics: face,
    lineSpacingPx: 0,
  });
}

function paint(text: string, face: StrikeFace, fontSizePx: number, strokeWidthPx = 0): ImageData {
  const layout = layoutFor(text, face, fontSizePx);
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

/** The first pixel with some alpha and less than all of it, as `[r, g, b, a]`. */
function firstPartialPixel(raster: ImageData): number[] | undefined {
  for (let at = 0; at < raster.data.length; at += 4) {
    const alpha = raster.data[at + 3]!;
    if (alpha > 0 && alpha < 255) return [...raster.data.subarray(at, at + 4)];
  }
  return undefined;
}

/** The layout of `text` with every glyph's origin moved `xOffset` px. */
function offsetLayout(text: string, face: StrikeFace, fontSizePx: number, xOffset: number) {
  const shaped = layoutFor(text, face, fontSizePx);
  const lines = shaped.lines.map((line) => ({
    ...line,
    glyphs: line.glyphs.map((glyph) => ({ ...glyph, xOffset })),
  }));
  return { ...shaped, lines };
}

/** The alpha-weighted mean column of a Label3D raster of `text` with each glyph moved `xOffset` px. */
function label3DInkCentreX(text: string, face: StrikeFace, fontSizePx: number, xOffset: number): number {
  const layout = offsetLayout(text, face, fontSizePx, xOffset);
  const canvasLayout = computeCanvasTextCanvasLayout(layout, 0, 0);
  const raster = paintSceneFontCanvas(layout, fontSizePx, TEAL, 0, canvasLayout, { glyphDrawer: 'label3D' })!;
  let weighted = 0;
  let total = 0;
  for (let at = 3; at < raster.data.length; at += 4) {
    weighted += raster.data[at]! * (((at - 3) / 4) % raster.width);
    total += raster.data[at]!;
  }
  return weighted / total;
}

describe('a strike face in the layout', () => {
  it('takes its ascent from the strike at the strike scale', () => {
    expect(getFontAscentPx(strikeFace(), 40)).toBe(36);
  });

  it('takes its line pitch from the strike at the strike scale', () => {
    expect(getFontLinePitchPx(strikeFace(), 30, 0)).toBe(Math.ceil(18 * 1.5 + 5 * 1.5));
  });

  it('draws an advance at the strike ppem times the strike scale', () => {
    // 530 units at 20 ppem are 678/64 px in 26.6, where 40 px would give 1357/64.
    const advance = getFontRunGlyphAdvancePx(
      strikeFace(),
      { char: 'A', glyph: STRIKE_GLYPH, advanceUnits: 530 },
      40
    );
    expect(advance).toBe((678 / 64) * 2);
  });
});

describe('a strike glyph in the canvas paint', () => {
  it('paints a BGRA bitmap in its own colour at the strike width', () => {
    const raster = paint('A', strikeFace(), 20);
    expect(opaqueColours(raster)).toEqual(['255,0,0']);
    expect(inkedPixelCount(raster)).toBe(4);
  });

  it('paints a grey bitmap in the font colour', () => {
    const raster = paint('A', strikeFace({ pixelMode: 'gray' }), 20);
    expect(opaqueColours(raster)).toEqual(['0,128,128']);
    expect(inkedPixelCount(raster)).toBe(4);
  });

  it('paints a grey bitmap at a glyph origin a Label3D keeps between pixels', () => {
    const shaped = layoutFor('A', strikeFace({ pixelMode: 'gray' }), 20);
    const [line] = shaped.lines;
    const glyphs = line!.glyphs.map((glyph) => ({ ...glyph, xOffset: 0.4 }));
    const layout = { ...shaped, lines: [{ ...line!, glyphs }] };
    const canvasLayout = computeCanvasTextCanvasLayout(layout, 0, 0);
    const raster = paintSceneFontCanvas(layout, 20, TEAL, 0, canvasLayout, { glyphDrawer: 'label3D' })!;
    expect(inkedPixelCount(raster)).toBeGreaterThan(0);
  });

  it('paints a 1-bit bitmap in the font colour', () => {
    expect(inkedPixelCount(paint('A', strikeFace({ pixelMode: 'mono' }), 20))).toBe(4);
  });

  it('paints nothing for a 2-bit or a 4-bit bitmap, which Godot does not copy', () => {
    expect(inkedPixelCount(paint('A', strikeFace({ pixelMode: 'gray2' }), 20))).toBe(0);
    expect(inkedPixelCount(paint('A', strikeFace({ pixelMode: 'gray4' }), 20))).toBe(0);
  });

  it('draws its quad over the bitmap and a margin of one texel, at the strike scale', () => {
    const layout = layoutFor('A', strikeFace(), 40);
    const [rect] = canvasGlyphRects(layout, 40, 0, computeCanvasTextCanvasLayout(layout, 0));
    expect([rect!.w, rect!.h]).toEqual([8, 8]);
  });

  it('samples white transparent texels past the bitmap edge, so its rim pales towards white', () => {
    const [red, green, blue] = firstPartialPixel(paint('A', strikeFace(), 40))!;
    expect(red).toBe(255);
    expect(green).toBeGreaterThan(0);
    expect(blue).toBe(green);
  });

  it('draws nothing of a bitmap in the outline pass', () => {
    expect(inkedPixelCount(paint('A', strikeFace(), 20, 2))).toBe(0);
  });

  it('draws the outline of a glyph the strike lacks in a scalable face', () => {
    expect(inkedPixelCount(paint('b', strikeFace({ isScalable: true }), 20))).toBeGreaterThan(0);
  });

  it("moves a Label3D's scaled outline glyph with its origin, with no subpixel step of a quarter pixel more", () => {
    const face = strikeFace({ isScalable: true });
    const movedPx = label3DInkCentreX('b', face, 16, 0.25) - label3DInkCentreX('b', face, 16, 0);
    // A quarter pixel moved by its origin, sampled through a filtered quad; a subpixel step would double it.
    expect(movedPx).toBeLessThan(0.4);
  });

  it('draws nothing for a glyph the strike lacks in a face of bitmaps alone', () => {
    expect(inkedPixelCount(paint('b', strikeFace(), 20))).toBe(0);
  });
});
