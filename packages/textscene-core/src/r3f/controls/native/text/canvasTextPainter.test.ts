import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  computeCanvasTextCanvasLayout,
  buildCanvasTextQuadArrays,
  createCanvasTextMaterial,
  originPhase,
  paintSceneFontCanvas,
} from './canvasTextPainter';
import { getFontAscentPx, withVariation, type OpentypeCoordinates } from './fontMetrics';
import { shapeText } from './textLayout';
import { createRuntimeFontMetrics } from './runtimeFontMetrics';
import { patchedFragment } from '../../../testing/patchedFragment';
import { mipmappedTexture } from '../../../testing/mipmapBiasUniform';
import { litPixelMaterial } from '../../../lighting2d/testing/litPixelMaterial';
import { AutowrapMode, ContourPointTag } from '../../../../godot/text/textServerEnums';
import type { GlyphContours } from './glyphContours';
import type { SfntOutlines } from './sfntOutlines';
import type { GlyphDrawer } from './glyphDrawer';
import type { Vector2 } from '../../../../godot/math/vector';

const CANVAS_METRICS = createRuntimeFontMetrics({
  hasGlyph: () => true,
  scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
  measureWidthUnits: (text) => text.length * 500,
  cssFontFamily: 'scene-font-test',
});

function layoutFor(text: string, lineSpacingPx = 3) {
  return shapeText(text, {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    fontMetrics: CANVAS_METRICS,
    lineSpacingPx,
  });
}

/**
 * Where the raster pixel for content-box x=0 (or y=0) lands in the quad's space:
 * the painter draws at `offsetXPx`/`offsetYPx` on a `canvasWidthPx` x
 * `canvasHeightPx` canvas, and the quad samples that whole canvas.
 */
function contentOriginOnQuad(canvasLayout: ReturnType<typeof computeCanvasTextCanvasLayout>): {
  x: number;
  y: number;
} {
  const { positions } = buildCanvasTextQuadArrays(canvasLayout);
  const [left, top] = [positions[0]!, positions[1]!];
  const [right, bottom] = [positions[3]!, positions[7]!];
  const { canvasWidthPx, canvasHeightPx, offsetXPx, offsetYPx } = canvasLayout;
  return {
    x: left + (offsetXPx / canvasWidthPx) * (right - left),
    // Quad Y is negated Godot Y (`buildCanvasTextQuadArrays`), so the
    // content-box top is the largest y.
    y: -(top + (offsetYPx / canvasHeightPx) * (bottom - top)),
  };
}

describe('computeCanvasTextCanvasLayout', () => {
  // A glyph's ink can pass its pen box by a side bearing, as a `j` does left of the line start.
  it('reaches one ascent and the pen snap past each end of the glyphs of a face that measures no ink, and keeps the content box at the quad origin', () => {
    const layout = layoutFor('AB');
    const canvasLayout = computeCanvasTextCanvasLayout(layout, 0);
    const reachPx = layout.baselineOffsetPx;
    const inkLeftPx = Math.floor(-reachPx - 2);
    expect(canvasLayout.offsetXPx).toBe(-inkLeftPx);
    expect(canvasLayout.canvasWidthPx).toBe(Math.ceil(layout.widthPx + reachPx + 1 - inkLeftPx));
    expect(contentOriginOnQuad(canvasLayout).x).toBeCloseTo(0, 6);
  });

  it("reaches a face's own ascent where it passes the line's baseline offset", () => {
    const layout = layoutFor('AB');
    const lowBaseline = { ...layout, baselineOffsetPx: 1 };
    const glyph = layout.lines[0]!.glyphs[0]!;
    const inkLeftPx = Math.floor(-getFontAscentPx(glyph.fontMetrics, glyph.fontSizePx) - 2);
    expect(computeCanvasTextCanvasLayout(lowBaseline, 0).offsetXPx).toBe(-inkLeftPx);
  });

  // A fallback face's run draws at the line's baseline, which the taller first face sets.
  it("reaches the line's ascent past a glyph of a shorter fallback face", () => {
    const shortFace = createRuntimeFontMetrics({
      hasGlyph: (ch) => ch === '一',
      scalars: { unitsPerEm: 1000, ascent: 100, descent: 100 },
      measureWidthUnits: (text) => text.length * 1000,
      cssFontFamily: 'short-fallback-test',
    });
    const firstFace = createRuntimeFontMetrics({
      hasGlyph: (ch) => ch !== '一',
      scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
      measureWidthUnits: (text) => text.length * 500,
      cssFontFamily: 'tall-first-face-test',
    });
    const layout = shapeText('A一', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      fontMetrics: { ...firstFace, fallbacks: [shortFace] },
      lineSpacingPx: 0,
    });
    const line = layout.lines[0]!;
    const fallbackGlyph = line.glyphs.find((glyph) => glyph.fontMetrics === shortFace)!;
    const fallbackRun = { ...layout, lines: [{ ...line, glyphs: [fallbackGlyph] }] };
    const inkLeftPx = Math.floor(fallbackGlyph.x - layout.baselineOffsetPx - 2);
    const canvasLayout = computeCanvasTextCanvasLayout(fallbackRun, 0);
    expect(canvasLayout.canvasWidthPx).toBe(
      Math.ceil(fallbackGlyph.x + fallbackGlyph.advance + layout.baselineOffsetPx + 1 - inkLeftPx)
    );
  });

  // A trimmed AUTO right-to-left fill draws past the trimmed width it reports (text_server.cpp:1744).
  it('ends the raster past the glyphs, not the layout width', () => {
    const layout = layoutFor('AB');
    const line = layout.lines[0]!;
    const narrowed = { ...layout, widthPx: 8, lines: [{ ...line, widthPx: 8 }] };
    expect(computeCanvasTextCanvasLayout(narrowed, 0).canvasWidthPx).toBe(
      computeCanvasTextCanvasLayout(layout, 0).canvasWidthPx
    );
  });

  // A fallback face's own run starts where its first glyph is on the line (`faceLayouts.ts`).
  it('starts the raster one ascent left of the first glyph of a run that starts mid-line', () => {
    const layout = layoutFor('ABCDEFGH');
    const line = layout.lines[0]!;
    const firstIndex = line.glyphs.findIndex((glyph) => glyph.x > 2 * layout.baselineOffsetPx);
    expect(firstIndex).toBeGreaterThan(0);
    const shifted = { ...layout, lines: [{ ...line, glyphs: line.glyphs.slice(firstIndex) }] };
    const reachPx = layout.baselineOffsetPx;
    const inkLeftPx = Math.floor(line.glyphs[firstIndex]!.x - reachPx - 2);
    const canvasLayout = computeCanvasTextCanvasLayout(shifted, 0);
    expect(canvasLayout.canvasWidthPx).toBe(Math.ceil(layout.widthPx + reachPx + 1 - inkLeftPx));
    expect(contentOriginOnQuad(canvasLayout).x).toBeCloseTo(0, 6);
  });

  it('reaches no further at a large line spacing, which moves no ink', () => {
    const tight = computeCanvasTextCanvasLayout(layoutFor('AB', 0), 0.3);
    const loose = computeCanvasTextCanvasLayout(layoutFor('AB', 2000), 0.3);
    expect(loose.offsetXPx).toBe(tight.offsetXPx);
    expect(loose.canvasWidthPx).toBe(tight.canvasWidthPx);
  });

  it("bounds the raster by a face's measured ink, with the pen box inside it", () => {
    // A `j`-like glyph whose ink reaches 100 units left of its pen and 300 right, at 16 px over 1000 units.
    const measured = createRuntimeFontMetrics({
      hasGlyph: () => true,
      scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
      measureWidthUnits: (text) => text.length * 500,
      measureInkUnits: () => ({ left: 100, right: 300 }),
      cssFontFamily: 'scene-font-ink-test',
    });
    const layout = shapeText('jj', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      fontMetrics: measured,
      lineSpacingPx: 0,
    });
    const canvasLayout = computeCanvasTextCanvasLayout(layout, 0);
    // 100 units at 16 px is 1.6 px left of the first pen, and the second glyph's pen box ends the ink.
    // The pen snap and the hinting take 2 px on the left and 1 px on the right: floor(-3.6) is -4,
    // and 16 + 1 + 4 is 21.
    expect(canvasLayout.offsetXPx).toBe(4);
    expect(canvasLayout.canvasWidthPx).toBe(21);
  });

  // `measureText` measures the default instance, which the outlines of another instance can pass.
  it('reaches one ascent past the glyphs of a face drawn at an instance, whose measured ink is the default', () => {
    const measured = createRuntimeFontMetrics({
      hasGlyph: () => true,
      scalars: { unitsPerEm: 1000, ascent: 800, descent: 200 },
      measureWidthUnits: (text) => text.length * 500,
      measureInkUnits: () => ({ left: 0, right: 500 }),
      cssFontFamily: 'scene-font-instance-ink-test',
    });
    const { outlines } = instanceOutlinesStub();
    const layout = shapeText('jj', {
      fontSizePx: 16,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      fontMetrics: withVariation(measured, { opentype: MONO_INSTANCE, outlines }),
      lineSpacingPx: 0,
    });
    const reachPx = layout.baselineOffsetPx;
    const inkLeftPx = Math.floor(-reachPx - 2);
    expect(computeCanvasTextCanvasLayout(layout, 0).offsetXPx).toBe(-inkLeftPx);
  });

  // The rows above the baseline run up to the vertical pad, and shear furthest there. A stroke
  // widens that pad past `CANVAS_TEXT_VERTICAL_PAD_PX`, so its top row shears further.
  it('pads a sheared raster by the shear of its top row', () => {
    const layout = layoutFor('AB');
    const strokeWidthPx = 8;
    const straight = computeCanvasTextCanvasLayout(layout, 0, strokeWidthPx);
    const skewed = computeCanvasTextCanvasLayout(layout, 0.3, strokeWidthPx);
    expect(skewed.offsetXPx - straight.offsetXPx).toBe(
      Math.ceil(0.3 * (layout.baselineOffsetPx + straight.offsetYPx))
    );
  });

  it('pads a sheared raster at a line spacing that takes the pitch below zero', () => {
    const layout = layoutFor('AB', -100);
    const straight = computeCanvasTextCanvasLayout(layout, 0);
    expect(computeCanvasTextCanvasLayout(layout, 0.3).offsetXPx).toBeGreaterThan(straight.offsetXPx);
  });

  it('widens by the origin phase, which carries the content that far right of the quad', () => {
    const layout = layoutFor('AB');
    const canvasLayout = computeCanvasTextCanvasLayout(layout, 0, 0, { x: 0.25, y: 0 });
    const reachPx = layout.baselineOffsetPx;
    const inkLeftPx = Math.floor(-reachPx - 2);
    expect(canvasLayout.canvasWidthPx).toBe(Math.ceil(layout.widthPx + reachPx + 1 - inkLeftPx + 0.25));
  });

  it('a nonzero skew widens the canvas symmetrically to fit the sheared ink, and offsets content by the same pad', () => {
    const layout = layoutFor('AB');
    const straight = computeCanvasTextCanvasLayout(layout, 0);
    const skewed = computeCanvasTextCanvasLayout(layout, 0.3);
    const padPx = skewed.offsetXPx - straight.offsetXPx;
    expect(padPx).toBeGreaterThan(0);
    // Symmetric: padding added equally left/right.
    expect(skewed.canvasWidthPx - straight.canvasWidthPx).toBe(2 * padPx);
  });

  // A fractional pad puts each texel between two screen pixels, and the linear filter then thins
  // every edge: an emboldened 32 px run drew 3% less ink than Godot.
  it('pads by whole pixels, so each texel of the raster lands on a screen pixel', () => {
    const emboldened = shapeText('AB', {
      fontSizePx: 32,
      boxWidthPx: 0,
      autowrapMode: AutowrapMode.AUTOWRAP_OFF,
      fontMetrics: withVariation(CANVAS_METRICS, { embolden: 1.8 }),
      lineSpacingPx: 3,
    });
    const canvasLayout = computeCanvasTextCanvasLayout(emboldened, 0.3, 1.5);
    expect(Number.isInteger(canvasLayout.offsetXPx)).toBe(true);
    expect(Number.isInteger(canvasLayout.offsetYPx)).toBe(true);
  });

  it('canvas height always exceeds the layout height by the same fixed vertical pad, independent of skew', () => {
    const layout = layoutFor('AB');
    const straight = computeCanvasTextCanvasLayout(layout, 0);
    const skewed = computeCanvasTextCanvasLayout(layout, 0.5);
    expect(straight.canvasHeightPx).toBeGreaterThan(layout.heightPx);
    expect(straight.canvasHeightPx).toBe(skewed.canvasHeightPx);
  });
});

/** `layout` shaped against a face that carries `outlines`, as the font loader hands it to a run. */
function carrying(layout: ReturnType<typeof layoutFor>, skew: number, outlines: SfntOutlines | null) {
  if (!outlines) return layout;
  const { embolden } = layout.fontMetrics;
  return { ...layout, fontMetrics: withVariation(layout.fontMetrics, { embolden, skew, outlines }) };
}

interface Call {
  op: string;
  args: unknown[];
  lineWidth: number;
  /** The horizontal shear (`c`) of the transform in force. */
  shear: number;
}

/** The alpha at raster pixel `(x, y)` of the image the paint put, 0 where it put none. */
function alphaAt(calls: readonly Call[], x: number, y: number): number {
  const put = calls.find((call) => call.op === 'putImageData');
  if (!put) return 0;
  const image = put.args[0] as ImageData;
  return image.data[(y * image.width + x) * 4 + 3]!;
}

/** The grown outline of a glyph: a triangle 4 px wide and 6 px tall, its base on the baseline. */
const GROWN_TRIANGLE: GlyphContours = {
  points: [
    { x: 1, y: 0, tag: ContourPointTag.ON },
    { x: 5, y: 0, tag: ContourPointTag.ON },
    { x: 3, y: -6, tag: ContourPointTag.ON },
  ],
  contourEnds: [2],
  isFillRight: true,
};

function outlinesStub(glyphIndex = 7) {
  const glyphContours = vi.fn(() => GROWN_TRIANGLE);
  return {
    outlines: { glyphIndex: () => glyphIndex, glyphContours } satisfies SfntOutlines,
    glyphContours,
  };
}

/** Records every draw call of one paint: happy-dom has no 2D context. A `strokeWidthPx` of 0 paints the fill. */
function paintRecording(
  layout: ReturnType<typeof layoutFor>,
  strokeWidthPx: number,
  {
    skew = 0,
    outlines = null,
    glyphDrawer,
    originPhasePx,
    fontSizePx = 16,
  }: {
    fontSizePx?: number;
    skew?: number;
    outlines?: SfntOutlines | null;
    glyphDrawer?: GlyphDrawer;
    originPhasePx?: Vector2;
  } = {}
) {
  const canvasLayout = computeCanvasTextCanvasLayout(layout, skew, strokeWidthPx);
  const calls: Call[] = [];
  let matrix = new DOMMatrix();
  const saved: DOMMatrix[] = [];
  const record =
    (op: string) =>
    (...args: unknown[]) =>
      calls.push({ op, args, lineWidth: ctx.lineWidth, shear: matrix.c });
  const ctx = {
    lineWidth: 1,
    save: () => saved.push(matrix),
    restore: () => {
      matrix = saved.pop()!;
    },
    transform: (a: number, b: number, c: number, d: number, e: number, f: number) => {
      matrix = matrix.multiply(new DOMMatrix([a, b, c, d, e, f]));
    },
    fillText: record('fillText'),
    strokeText: record('strokeText'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    closePath: record('closePath'),
    fill: record('fill'),
    stroke: record('stroke'),
    canvas: { width: canvasLayout.canvasWidthPx, height: canvasLayout.canvasHeightPx },
    getImageData: (_x: number, _y: number, width: number, height: number) => ({
      data: new Uint8ClampedArray(width * height * 4),
      width,
      height,
    }),
    putImageData: record('putImageData'),
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never);
  paintSceneFontCanvas(
    carrying(layout, skew, outlines),
    fontSizePx,
    { r: 1, g: 1, b: 1, a: 1 },
    skew,
    canvasLayout,
    {
      strokeWidthPx,
      glyphDrawer,
      originPhasePx,
    }
  );
  return { calls, canvasLayout };
}

function boldLayoutFor(text: string, embolden: number) {
  return shapeText(text, {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    fontMetrics: withVariation(CANVAS_METRICS, { embolden }),
    lineSpacingPx: 0,
  });
}

// `FT_Outline_Embolden` grows the outline by `embolden * size / 16` px and anchors it at the left
// and bottom (`text_server_adv.cpp:1314-1315`): half the growth on each side, then a shift of half.
describe('embolden padding', () => {
  // The growth is 1.2 * 16 / 16 = 1.2 px, which the pad rounds up to 2 whole pixels.
  it('pads the raster by the outline growth on every side, so the grown ink stays inside it', () => {
    const plain = computeCanvasTextCanvasLayout(layoutFor('AB', 0), 0);
    const bold = computeCanvasTextCanvasLayout(boldLayoutFor('AB', 1.2), 0);
    expect(bold.offsetXPx).toBe(plain.offsetXPx + 2);
    expect(bold.offsetYPx).toBe(plain.offsetYPx + 2);
  });

  it('pads by the largest growth when two glyphs differ', () => {
    const plain = computeCanvasTextCanvasLayout(layoutFor('AB', 0), 0);
    const layout = layoutFor('AB', 0);
    layout.lines[0]!.glyphs[1]!.emboldenGrowthPx = 2;
    expect(computeCanvasTextCanvasLayout(layout, 0).offsetXPx).toBe(plain.offsetXPx + 2);
  });
});

describe('paintSceneFontCanvas — pen', () => {
  /** A two-glyph line whose second pen sits between quarter pixels, as a justified line can put it. */
  function fractionalPenLayout() {
    const layout = layoutFor('AB', 0);
    layout.lines[0]!.glyphs[1]!.x = 10.6;
    return layout;
  }

  it('draws a glyph at the quarter pixel a 16 px canvas item rounds its pen to', () => {
    const { calls, canvasLayout } = paintRecording(fractionalPenLayout(), 0);
    expect(calls.filter((c) => c.op === 'fillText')[1]!.args[1]).toBe(canvasLayout.offsetXPx + 10.5);
  });

  it('rounds the pen where it sits in the canvas item, past the whole pixel the quad starts on', () => {
    const { calls, canvasLayout } = paintRecording(fractionalPenLayout(), 0, {
      originPhasePx: { x: 0.3, y: 0 },
    });
    // 0.3 + 10.6 = 10.9 rounds to the quarter step 11, and the quad starts at the floored origin 0.
    expect(calls.filter((c) => c.op === 'fillText')[1]!.args[1]).toBe(canvasLayout.offsetXPx + 11);
  });

  // `text_server_adv.cpp:4082-4084`: a glyph at scale 1 draws at the floored `cpos.y`.
  it('puts the baseline on the whole pixel a canvas item floors it to, its run origin included', () => {
    const layout = layoutFor('A\nB', 0.5);
    const { calls, canvasLayout } = paintRecording(layout, 0, { originPhasePx: { x: 0, y: 0.6 } });
    // The second baseline sits 17.5 + 13 px down, which the origin carries to 31.1 and the floor to 31.
    expect(layout.linePitchPx + layout.baselineOffsetPx).toBeCloseTo(30.5, 9);
    expect(calls.filter((c) => c.op === 'fillText')[1]!.args[2]).toBe(canvasLayout.offsetYPx + 31);
  });

  // Godot's `int64_t` size has no fraction, so a fractional one draws at `scale != 1.0` (`canvasGlyphPenXPx`).
  it('keeps the baseline of a fractional font size, which draws off the scale-1 branch', () => {
    const layout = layoutFor('A\nB', 0.5);
    const { calls, canvasLayout } = paintRecording(layout, 0, {
      fontSizePx: 15.5,
      originPhasePx: { x: 0, y: 0.6 },
    });
    expect(calls.filter((c) => c.op === 'fillText')[1]!.args[2]).toBeCloseTo(
      canvasLayout.offsetYPx + 30.5,
      9
    );
  });

  it('keeps the pen of a Label3D, whose mesh places each glyph where it is', () => {
    const { calls, canvasLayout } = paintRecording(fractionalPenLayout(), 0, {
      glyphDrawer: 'label3D',
      originPhasePx: { x: 0.3, y: 0.6 },
    });
    expect(calls.filter((c) => c.op === 'fillText')[1]!.args[1]).toBe(canvasLayout.offsetXPx + 10.6);
  });

  it('keeps the baseline of a Label3D', () => {
    const layout = fractionalPenLayout();
    const { calls, canvasLayout } = paintRecording(layout, 0, {
      glyphDrawer: 'label3D',
      originPhasePx: { x: 0.3, y: 0.6 },
    });
    expect(calls.filter((c) => c.op === 'fillText')[0]!.args[2]).toBe(
      canvasLayout.offsetYPx + layout.baselineOffsetPx
    );
  });
});

describe('paintSceneFontCanvas — embolden', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rasterises on the CPU, whose exact-area coverage FreeType shares, not the GPU path rasteriser', () => {
    paintRecording(layoutFor('A', 0), 0);
    expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d', { willReadFrequently: true });
  });

  it('draws a plain glyph with one fill and no stroke', () => {
    const { calls } = paintRecording(layoutFor('A', 0), 0);
    expect(calls.map((c) => c.op)).toEqual(['fillText']);
  });

  it('draws a bold glyph filled and stroked by the growth, shifted right and up by half of it', () => {
    const layout = boldLayoutFor('A', 1.2);
    const { calls, canvasLayout } = paintRecording(layout, 0);
    const growthPx = 1.2;
    const baselineY = canvasLayout.offsetYPx + layout.baselineOffsetPx;
    const expectedArgs = ['A', canvasLayout.offsetXPx + growthPx / 2, baselineY - growthPx / 2];
    expect(calls.map((c) => c.op)).toEqual(['fillText', 'strokeText']);
    expect(calls[0]!.args).toEqual(expectedArgs);
    expect(calls[1]!.args).toEqual(expectedArgs);
    expect(calls[1]!.lineWidth).toBeCloseTo(growthPx, 10);
  });
});

describe('paintSceneFontCanvas — embolden fill from the grown contour', () => {
  afterEach(() => vi.restoreAllMocks());

  // Chromium snaps the baseline of `fillText` to a whole pixel, so a fill at half the growth above
  // the baseline lands a pixel off its own shift. FreeType fills the contour, which has no snap.
  it('fills the grown outline of a bold glyph from its pen, in place of the text', () => {
    const layout = boldLayoutFor('A', 1.2);
    const { outlines, glyphContours } = outlinesStub();
    const { calls, canvasLayout } = paintRecording(layout, 0, { skew: 0, outlines });
    const penX = canvasLayout.offsetXPx;
    const baselineY = canvasLayout.offsetYPx + layout.baselineOffsetPx;

    expect(glyphContours).toHaveBeenCalledWith(7, 16, { embolden: 1.2, skew: 0 });
    expect(calls.map((call) => call.op)).toEqual(['putImageData']);
    expect(alphaAt(calls, penX + 3, baselineY - 3)).toBe(255);
    expect(alphaAt(calls, penX, baselineY - 1)).toBe(0);
  });

  // A negative embolden shrinks the outline (`FT_Outline_Embolden`); a stroke of a negative width cannot.
  it('fills the shrunk outline of a glyph with a negative embolden', () => {
    const { outlines, glyphContours } = outlinesStub();
    const { calls } = paintRecording(boldLayoutFor('A', -0.5), 0, { skew: 0, outlines });

    expect(glyphContours).toHaveBeenCalledWith(7, 16, { embolden: -0.5, skew: 0 });
    expect(calls.map((call) => call.op)).toEqual(['putImageData']);
  });

  it('fills a bold and sheared glyph by one outline that carries both, under the identity transform', () => {
    const { outlines, glyphContours } = outlinesStub();
    const { calls } = paintRecording(boldLayoutFor('A', 1.2), 0, { skew: 0.3, outlines });

    expect(glyphContours).toHaveBeenCalledWith(7, 16, { embolden: 1.2, skew: 0.3 });
    expect(calls.map((call) => call.op)).toEqual(['putImageData']);
    expect(calls.every((call) => call.shear === 0)).toBe(true);
  });

  it('shears the text of a bold and sheared glyph that the font has no contour for', () => {
    const empty: SfntOutlines = { glyphIndex: () => 7, glyphContours: () => null };
    const { calls } = paintRecording(boldLayoutFor('A', 1.2), 0, { skew: 0.3, outlines: empty });

    expect(calls.map((call) => call.op)).toEqual(['fillText', 'strokeText']);
    expect(calls.every((call) => Math.abs(call.shear + 0.3) < 1e-9)).toBe(true);
  });

  // Godot fills the hinted outline of every glyph through FreeType (`text_server_adv.cpp:1360-1373`).
  it('fills the outline of a plain glyph from its pen, in place of the text', () => {
    const layout = layoutFor('A', 0);
    const { outlines, glyphContours } = outlinesStub();
    const { calls, canvasLayout } = paintRecording(layout, 0, { skew: 0, outlines });
    const penX = canvasLayout.offsetXPx;
    const baselineY = canvasLayout.offsetYPx + layout.baselineOffsetPx;

    expect(glyphContours).toHaveBeenCalledWith(7, 16, { embolden: 0, skew: 0 });
    expect(calls.map((call) => call.op)).toEqual(['putImageData']);
    expect(alphaAt(calls, penX + 3, baselineY - 3)).toBe(255);
    expect(alphaAt(calls, penX + 3, baselineY + 1)).toBe(0);
  });

  it('fills the sheared outline of a sheared glyph under the identity transform', () => {
    const { outlines, glyphContours } = outlinesStub();
    const { calls } = paintRecording(layoutFor('A', 0), 0, { skew: 0.3, outlines });

    expect(glyphContours).toHaveBeenCalledWith(7, 16, { embolden: 0, skew: 0.3 });
    expect(calls.map((call) => call.op)).toEqual(['putImageData']);
    expect(calls.every((call) => call.shear === 0)).toBe(true);
  });
});

describe('paintSceneFontCanvas — embolden under an outline stroke', () => {
  afterEach(() => vi.restoreAllMocks());

  // Godot strokes the hinted outline of every glyph (`text_server_adv.cpp:1376-1393`), a ring the
  // radius each side of the contour: 2 px for a 4 px stroke.
  it('strokes the outline of a plain glyph into a ring round its contour at its pen', () => {
    const layout = layoutFor('A', 0);
    const { outlines } = outlinesStub();
    const { calls, canvasLayout } = paintRecording(layout, 4, { outlines });
    const penX = canvasLayout.offsetXPx;
    const baselineY = canvasLayout.offsetYPx + layout.baselineOffsetPx;

    expect(calls.map((call) => call.op)).toEqual(['putImageData']);
    expect(alphaAt(calls, penX + 3, baselineY + 1)).toBe(255);
    expect(alphaAt(calls, penX + 3, baselineY + 2)).toBe(0);
  });

  // FreeType strokes the emboldened contour (`text_server_adv.cpp:1314-1315`, then `:1383-1390`).
  it('strokes the grown outline of a bold glyph, in place of the text', () => {
    const { outlines, glyphContours } = outlinesStub(7);
    const { calls } = paintRecording(boldLayoutFor('A', 1.2), 4, { outlines });

    expect(glyphContours).toHaveBeenCalledWith(7, 16, { embolden: 1.2, skew: 0 });
    expect(calls.map((call) => call.op)).toEqual(['putImageData']);
  });

  it('grows the outline of a repeated character once for the whole paint', () => {
    const { outlines, glyphContours } = outlinesStub();

    paintRecording(boldLayoutFor('AAA', 1.2), 4, { outlines });

    expect(glyphContours).toHaveBeenCalledTimes(1);
  });

  // Godot strokes the sheared outline (`text_server_adv.cpp:1318-1320`, then `:1383-1390`), so the
  // shear is in the path points and the line keeps its width in every direction.
  it('strokes the sheared outline of a sheared glyph under the identity transform', () => {
    const { outlines, glyphContours } = outlinesStub(7);
    const { calls } = paintRecording(layoutFor('A', 0), 4, { skew: 0.3, outlines });

    expect(glyphContours).toHaveBeenCalledWith(7, 16, { embolden: 0, skew: 0.3 });
    expect(calls.map((call) => call.op)).toEqual(['putImageData']);
    expect(calls.every((call) => call.shear === 0)).toBe(true);
  });

  it('strokes a bold and sheared glyph by one outline that carries both', () => {
    const { outlines, glyphContours } = outlinesStub(7);

    paintRecording(boldLayoutFor('A', 1.2), 4, { skew: 0.3, outlines });

    expect(glyphContours).toHaveBeenCalledWith(7, 16, { embolden: 1.2, skew: 0.3 });
  });

  it('strokes the text of a sheared glyph in the sheared space where the label has no outlines', () => {
    const { calls } = paintRecording(layoutFor('A', 0), 4, { skew: 0.3 });

    expect(calls.map((call) => call.op)).toEqual(['strokeText']);
    expect(calls[0]!.shear).toBeCloseTo(-0.3, 10);
  });

  it('strokes the text of a sheared glyph that the font has no glyph for in the sheared space', () => {
    const { outlines } = outlinesStub(0);
    const { calls } = paintRecording(layoutFor('A', 0), 4, { skew: 0.3, outlines });

    expect(calls.map((call) => call.op)).toEqual(['strokeText']);
    expect(calls[0]!.shear).toBeCloseTo(-0.3, 10);
  });

  it('strokes the text of a bold glyph where the label has no outlines', () => {
    const { calls } = paintRecording(boldLayoutFor('A', 1.2), 4);

    expect(calls.map((call) => call.op)).toEqual(['strokeText']);
  });

  it('strokes the text of a bold glyph that the font has no glyph for', () => {
    const { outlines } = outlinesStub(0);
    const { calls } = paintRecording(boldLayoutFor('A', 1.2), 4, { outlines });

    expect(calls.map((call) => call.op)).toEqual(['strokeText']);
  });
});

/** `MONO` at 1: Recursive's monospace instance. */
const MONO_INSTANCE: OpentypeCoordinates = new Map([[1297043023, 1]]);

/** Outlines whose axis values draw an instance other than the default where `drawsInstance` answers so. */
function variableOutlinesStub(drawsInstance: () => boolean) {
  const { outlines, glyphContours } = outlinesStub();
  return { outlines: { ...outlines, drawsInstance } satisfies SfntOutlines, glyphContours };
}

const instanceOutlinesStub = () => variableOutlinesStub(() => true);
const defaultInstanceOutlinesStub = () => variableOutlinesStub(() => false);

/** `text` shaped against the canvas face at `MONO_INSTANCE`, which carries `outlines` as the font loader hands it to a run. */
function instanceLayoutFor(text: string, outlines: SfntOutlines) {
  return shapeText(text, {
    fontSizePx: 16,
    boxWidthPx: 0,
    autowrapMode: AutowrapMode.AUTOWRAP_OFF,
    fontMetrics: withVariation(CANVAS_METRICS, { opentype: MONO_INSTANCE, outlines }),
    lineSpacingPx: 0,
  });
}

// FreeType draws a glyph at the coordinates set on the face (`text_server_adv.cpp:1915-1950`), which
// `fillText` cannot: canvas text has no font variation settings.
describe('paintSceneFontCanvas — a variable font at an instance', () => {
  afterEach(() => vi.restoreAllMocks());

  // Godot loads the glyph at the axis values of the face's `variation_opentype` (`text_server_adv.cpp:1260-1268`).
  it('fills the outline of a glyph at a non-default instance, in place of the text', () => {
    const { outlines, glyphContours } = instanceOutlinesStub();
    const { calls } = paintRecording(instanceLayoutFor('A', outlines), 0);

    expect(glyphContours).toHaveBeenCalledWith(7, 16, { embolden: 0, skew: 0, opentype: MONO_INSTANCE });
    expect(calls.map((call) => call.op)).toEqual(['putImageData']);
  });

  it('strokes the ring of the outline at a non-default instance', () => {
    const { outlines, glyphContours } = instanceOutlinesStub();
    const { calls } = paintRecording(instanceLayoutFor('A', outlines), 4);

    expect(glyphContours).toHaveBeenCalledWith(7, 16, { embolden: 0, skew: 0, opentype: MONO_INSTANCE });
    expect(calls.map((call) => call.op)).toEqual(['putImageData']);
  });

  it('reads the default glyph where the axis values draw the default instance', () => {
    const { outlines, glyphContours } = defaultInstanceOutlinesStub();
    paintRecording(instanceLayoutFor('A', outlines), 0);

    expect(glyphContours).toHaveBeenCalledWith(7, 16, { embolden: 0, skew: 0, opentype: undefined });
  });

  it('fills the text of a glyph the font has no outline for at an instance', () => {
    const { outlines } = instanceOutlinesStub();
    const empty: SfntOutlines = { ...outlines, glyphContours: () => null };
    const { calls } = paintRecording(instanceLayoutFor('A', empty), 0);

    expect(calls.map((call) => call.op)).toEqual(['fillText']);
  });
});

describe('the outline surface overlays the fill surface exactly', () => {
  // Label3D draws a stroked outline (`label_3d.cpp:610-615`) and the fill from one
  // layout, and they line up despite the stroke padding. Fractional line spacing
  // keeps both surfaces off whole pixels.
  const layout = layoutFor('AB', 0.5);
  const stroked = computeCanvasTextCanvasLayout(layout, 0, 1.5);
  const filled = computeCanvasTextCanvasLayout(layout, 0, 0);

  it('puts the content-box origin at the same place on a stroked and an unstroked quad', () => {
    const a = contentOriginOnQuad(stroked);
    const b = contentOriginOnQuad(filled);
    expect(a.x).toBeCloseTo(b.x, 6);
    expect(a.y).toBeCloseTo(b.y, 6);
  });

  it('puts it exactly at the quad origin, so neighbouring runs laid out against layout.widthPx line up', () => {
    for (const canvasLayout of [stroked, filled]) {
      const origin = contentOriginOnQuad(canvasLayout);
      expect(origin.x).toBeCloseTo(0, 6);
      expect(origin.y).toBeCloseTo(0, 6);
    }
  });
});

describe('originPhase', () => {
  it('measures a negative place from the whole pixel below it, where Godot floors it', () => {
    expect(originPhase({ x: -0.25, y: 2.75 })).toEqual({ x: 0.75, y: 0.75 });
  });
});

describe('buildCanvasTextQuadArrays', () => {
  it('emits exactly one quad (4 verts, 6 indices) regardless of glyph count', () => {
    const layout = layoutFor('Hello World');
    const canvasLayout = computeCanvasTextCanvasLayout(layout, 0);
    const arrays = buildCanvasTextQuadArrays(canvasLayout);
    expect(arrays.positions.length).toBe(4 * 3);
    expect(arrays.uvs.length).toBe(4 * 2);
    expect(arrays.indices.length).toBe(6);
  });

  it('the quad spans exactly the PADDED canvas box, in Godot px (+Y down) negated to three-local Y-up, offset so the UNPADDED content still starts at local x=0', () => {
    const layout = layoutFor('AB');
    const canvasLayout = computeCanvasTextCanvasLayout(layout, 0.3);
    const arrays = buildCanvasTextQuadArrays(canvasLayout);
    // Vertex order TL, TR, BL, BR, as in buildGlyphQuadArrays.
    const tlX = arrays.positions[0]!;
    const tlY = arrays.positions[1]!;
    const trX = arrays.positions[3]!;
    const blY = arrays.positions[2 * 3 + 1]!;
    expect(tlX).toBeCloseTo(-canvasLayout.offsetXPx, 6);
    expect(trX).toBeCloseTo(canvasLayout.canvasWidthPx - canvasLayout.offsetXPx, 6);
    // Y is negated (three-local Y-up); top edge y = -(-offsetYPx) = offsetYPx (above the content box).
    expect(tlY).toBeCloseTo(canvasLayout.offsetYPx, 6);
    expect(blY).toBeCloseTo(-(canvasLayout.canvasHeightPx - canvasLayout.offsetYPx), 6);
  });

  it('moves back to the whole pixel at or before a fractional item origin, so each texel lands on a pixel', () => {
    const canvasLayout = computeCanvasTextCanvasLayout(layoutFor('AB'), 0);
    const arrays = buildCanvasTextQuadArrays(canvasLayout, { x: 0.25, y: 0.75 });
    expect(arrays.positions[0]).toBeCloseTo(-canvasLayout.offsetXPx - 0.25, 6);
    expect(arrays.positions[1]).toBeCloseTo(canvasLayout.offsetYPx + 0.75, 6);
  });

  it('UVs cover the full [0,1] texture with flipY convention (top edge v=1)', () => {
    const layout = layoutFor('AB');
    const canvasLayout = computeCanvasTextCanvasLayout(layout, 0);
    const arrays = buildCanvasTextQuadArrays(canvasLayout);
    // TL uv
    expect(arrays.uvs[0]).toBe(0);
    expect(arrays.uvs[1]).toBe(1);
    // BR uv
    expect(arrays.uvs[3 * 2]).toBe(1);
    expect(arrays.uvs[3 * 2 + 1]).toBe(0);
  });
});

describe('createCanvasTextMaterial mipmapped', () => {
  it('samples a mipmapped raster at the viewport mipmap bias', () => {
    const material = createCanvasTextMaterial({ map: mipmappedTexture(), opacity: 1, mipmapped: true });

    expect(patchedFragment(material)).toContain('godotMipmapBiased( map,');
  });

  it('leaves a raster with no mip chain as three samples it', () => {
    const material = createCanvasTextMaterial({ map: mipmappedTexture(), opacity: 1 });

    expect(patchedFragment(material)).not.toContain('godotMipmapBias');
  });
});

describe('createCanvasTextMaterial inside a lit Control', () => {
  const lit = () =>
    createCanvasTextMaterial({ map: mipmappedTexture(), opacity: 1, pixelMaterial: litPixelMaterial() });

  it('samples the light list before the colour encode', () => {
    expect(patchedFragment(lit())).toContain('uLightList');
  });

  it('keeps an explicit side over the facing of the Control material', () => {
    const material = createCanvasTextMaterial({
      map: mipmappedTexture(),
      opacity: 1,
      side: THREE.FrontSide,
      pixelMaterial: litPixelMaterial(),
    });

    expect(material.side).toBe(THREE.FrontSide);
  });

  it('takes the blend state of the Control material', () => {
    const material = lit();

    expect(material.blending).toBe(THREE.CustomBlending);
    expect(material.blendDst).toBe(THREE.OneFactor);
  });
});

describe('createCanvasTextMaterial', () => {
  it('is transparent, depth-write disabled, samples the given texture, and applies opacity directly (tint is pre-baked into the raster, unlike the MSDF uColor uniform)', () => {
    const texture = new THREE.CanvasTexture(document.createElement('canvas'));
    const mat = createCanvasTextMaterial({ map: texture, opacity: 0.5 });
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    expect(mat.map).toBe(texture);
    expect(mat.opacity).toBe(0.5);
  });

  it('forwards depthTest/side/clippingPlanes, matching createMsdfMaterial’s own contract', () => {
    const texture = new THREE.CanvasTexture(document.createElement('canvas'));
    const planes = [new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)];
    const mat = createCanvasTextMaterial({
      map: texture,
      opacity: 1,
      depthTest: true,
      side: THREE.FrontSide,
      clippingPlanes: planes,
    });
    expect(mat.depthTest).toBe(true);
    expect(mat.side).toBe(THREE.FrontSide);
    expect(mat.clippingPlanes).toEqual(planes);
  });

  it(
    "sets the sRGB-multiply define when `map` is tagged NoColorSpace: Godot's 2D canvas filters " +
      'and multiplies the encoded bytes of every texture it samples (`rendering/viewport/hdr_2d` ' +
      'default false, `rendering_server.cpp:3771`, `texture_storage.cpp:754`), and the define ' +
      'decodes the product after the filter and the multiply.',
    () => {
      const texture = new THREE.CanvasTexture(document.createElement('canvas'));
      texture.colorSpace = THREE.NoColorSpace;
      const mat = createCanvasTextMaterial({ map: texture, opacity: 1 });
      expect(mat.defines?.CANVAS_SRGB_MULTIPLY).toBe('');
    }
  );

  it(
    'leaves `defines` unset for a `map` NOT tagged NoColorSpace, so a caller that ever passes an ' +
      'already-linear map (a SubViewport render target, say) is not double-decoded -- the same ' +
      'auto-detection `canvasMapProps`/`ControlQuad` already apply to every other ' +
      '2D-canvas-drawn `map`.',
    () => {
      const texture = new THREE.CanvasTexture(document.createElement('canvas'));
      texture.colorSpace = THREE.SRGBColorSpace;
      const mat = createCanvasTextMaterial({ map: texture, opacity: 1 });
      expect(mat.defines).toBeUndefined();
    }
  );
});
