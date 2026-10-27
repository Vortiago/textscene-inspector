import { describe, expect, it } from 'vitest';
import { hexCodeBoxAdvanceSize } from '../../../r3f/controls/native/text/hexCodeBox';
import { OPEN_SANS_FONT_METRICS } from '../../../r3f/controls/native/text/openSansFontMetrics';
import { parseSfntOutlines } from '../../../r3f/controls/native/text/sfntOutlines';
import { fixtureFontBytes } from '../../../r3f/controls/native/text/sfntOutlines.testkit';
import { shapedTextSizeWidthPx, shapeText } from '../../../r3f/controls/native/text/textLayout';
import { AutowrapMode } from '../../../godot/text/textServerEnums';
import type { GodotSurface } from '../godotSurface';
import { expectClockwiseFronts } from '../primitivemesh/surface.testkit';
import { buildTextMeshSurface, type TextMeshFace } from './build';
import { decodeTextMesh } from './decode';
import { buildGlyphMeshData, type GlyphMeshData } from './glyphMesh';

const FONT_SIZE = 64;
const PIXEL_SIZE = 0.01;
const LEFT = '0';
const RIGHT = '2';
const FILL = '3';
const TOP = '0';
const BOTTOM = '2';
/** Half the default depth of 0.05, as the surface's float stores it. */
const HALF_DEPTH = Math.fround(0.025);

const outlines = parseSfntOutlines(fixtureFontBytes('open-sans-semibold-subset.ttf'))!;
const face: TextMeshFace = { outlines, metrics: OPEN_SANS_FONT_METRICS };

/** A TextMesh at `font_size` 64 with depth 0.05, the properties of `raw` over those defaults, built. */
function surfaceOf(text: string, raw: Record<string, string> = {}): GodotSurface {
  const properties = decodeTextMesh({ text: `"${text}"`, font_size: String(FONT_SIZE), ...raw });
  return buildTextMeshSurface(properties, face);
}

/** The mesh data of `char` as the TextMesh builds it at the defaults of `surfaceOf`. */
function glyphOf(char: string): GlyphMeshData {
  const index = outlines.glyphIndex(char.codePointAt(0)!);
  return buildGlyphMeshData(outlines.glyphContours(index, FONT_SIZE), PIXEL_SIZE, 0.5);
}

/** One of `x`, `y`, `z` of every vertex. */
const axis = (surface: GodotSurface, component: 0 | 1 | 2): number[] =>
  Array.from({ length: surface.positions.length / 3 }, (_v, i) => surface.positions[i * 3 + component]!);
const uvAxis = (surface: GodotSurface, component: 0 | 1): number[] =>
  Array.from({ length: surface.uvs!.length / 2 }, (_v, i) => surface.uvs![i * 2 + component]!);
const normalZ = (surface: GodotSurface): number[] =>
  Array.from({ length: surface.normals!.length / 3 }, (_v, i) => surface.normals![i * 3 + 2]!);

/** The vertex numbers whose normal points along z by `sign`, or the side vertices for 0. */
const verticesFacing = (surface: GodotSurface, sign: -1 | 0 | 1): number[] =>
  normalZ(surface).flatMap((z, i) => (z === sign ? [i] : []));

const extent = (values: readonly number[]) => ({ min: Math.min(...values), max: Math.max(...values) });

/** The shaped line of `text` as `surfaceOf` shapes it, for the widths and the pitch the placement reads. */
function shapedLines(
  text: string,
  lineSpacingPx = 0,
  boxWidthPx = 500,
  autowrapMode = AutowrapMode.AUTOWRAP_OFF
) {
  return shapeText(text, {
    fontSizePx: FONT_SIZE,
    boxWidthPx,
    autowrapMode,
    lineSpacingPx,
    fontMetrics: OPEN_SANS_FONT_METRICS,
  });
}

describe('buildTextMeshSurface counts', () => {
  const glyph = glyphOf('H');
  const cornerCount = glyph.triangles.length;
  const sideVertexCount = glyph.contours.reduce((sum, contour) => sum + contour.length, 0);

  it('writes a front and a back corner for each triangle corner, and four vertices for each side segment', () => {
    const surface = surfaceOf('H');
    expect(surface.positions.length / 3).toBe(2 * cornerCount + 4 * sideVertexCount);
    expect(surface.indices.length).toBe(2 * cornerCount + 6 * sideVertexCount);
  });

  it('writes the front face only when depth is zero', () => {
    const surface = surfaceOf('H', { depth: '0.0' });
    expect(surface.positions.length / 3).toBe(cornerCount);
    expect(surface.indices.length).toBe(cornerCount);
  });

  it('writes a second copy of the glyph for each repeat of it', () => {
    expect(surfaceOf('HH').positions.length).toBe(2 * surfaceOf('H').positions.length);
  });
});

describe('buildTextMeshSurface empty text', () => {
  it.each([
    ['no text', ''],
    ['only spaces', '   '],
  ])('adds the one degenerate triangle for %s', (_name, text) => {
    const surface = surfaceOf(text);
    expect(Array.from(surface.positions)).toEqual([0, 0, 0]);
    expect(Array.from(surface.normals!)).toEqual([0, 0, 0]);
    expect(Array.from(surface.tangents!)).toEqual([1, 0, 0, 1]);
    expect(Array.from(surface.uvs!)).toEqual([0, 0]);
    expect(Array.from(surface.indices)).toEqual([0, 0, 0]);
  });
});

describe('buildTextMeshSurface faces', () => {
  const surface = surfaceOf('H');

  it('puts the front face at +depth/2 and the back face at -depth/2', () => {
    const z = axis(surface, 2);
    expect(verticesFacing(surface, 1).map((i) => z[i])).toSatisfy((values: number[]) =>
      values.every((value) => value === HALF_DEPTH)
    );
    expect(verticesFacing(surface, -1).map((i) => z[i])).toSatisfy((values: number[]) =>
      values.every((value) => value === -HALF_DEPTH)
    );
  });

  it('winds every triangle clockwise against the normal of its first corner', () => {
    expectClockwiseFronts(surface);
  });

  it('gives the front face the tangent +x and the back face the tangent -x', () => {
    const tangents = surface.tangents!;
    const front = verticesFacing(surface, 1)[0]!;
    const back = verticesFacing(surface, -1)[0]!;
    expect(Array.from(tangents.slice(front * 4, front * 4 + 4))).toEqual([1, 0, 0, 1]);
    expect(Array.from(tangents.slice(back * 4, back * 4 + 4))).toEqual([-1, 0, 0, 1]);
  });
});

describe('buildTextMeshSurface UV', () => {
  const surface = surfaceOf('H');
  const v = uvAxis(surface, 1);
  const inBand = (vertices: number[], low: number, high: number) =>
    vertices.every((i) => v[i]! >= low - 1e-6 && v[i]! <= high + 1e-6);

  it('maps the front face to the top 0 to 0.4 of V, the back face to 0.4 to 0.8 and the sides to 0.8 to 1', () => {
    expect(inBand(verticesFacing(surface, 1), 0, 0.4)).toBe(true);
    expect(inBand(verticesFacing(surface, -1), 0.4, 0.8)).toBe(true);
    expect(inBand(verticesFacing(surface, 0), 0.8, 1)).toBe(true);
  });

  it('spans the front face over the whole V and U of the glyph box when depth is zero', () => {
    const flat = surfaceOf('H', { depth: '0.0' });
    const flatY = axis(flat, 1);
    const flatV = uvAxis(flat, 1);
    const flatU = uvAxis(flat, 0);
    expect(flatV[flatY.indexOf(Math.max(...flatY))]).toBeCloseTo(0, 6);
    expect(flatV[flatY.indexOf(Math.min(...flatY))]).toBeCloseTo(1, 6);
    expect([Math.min(...flatU), Math.max(...flatU)]).toEqual([0, 1]);
  });

  it('puts a side segment on row 0.8 to 0.9 of a counter-clockwise contour and 0.9 to 1 of a clockwise one', () => {
    const glyph = glyphOf('H');
    const rows = glyph.contoursInfo[0]!.isCounterClockwise ? [0.8, 0.9] : [0.9, 1];
    const side = verticesFacing(surface, 0);
    const firstQuad = side.slice(0, 4).map((i) => v[i]!);
    expect(firstQuad.map((value) => Number(value.toFixed(6)))).toEqual([rows[0], rows[0], rows[1], rows[1]]);
  });

  it('runs U along a side contour from 0 by the length of each segment over the length of the contour', () => {
    const glyph = glyphOf('H');
    const [first, second] = glyph.contours[0]!;
    const segment = Math.hypot(second!.point.x - first!.point.x, second!.point.y - first!.point.y);
    const u = uvAxis(surface, 0);
    const side = verticesFacing(surface, 0);
    expect([u[side[0]!], u[side[1]!]]).toEqual([
      0,
      expect.closeTo(segment / glyph.contoursInfo[0]!.length, 5),
    ]);
  });
});

describe('buildTextMeshSurface sides', () => {
  const surface = surfaceOf('H');
  const side = verticesFacing(surface, 0);

  it('gives each side vertex a unit normal in the xy plane and a tangent perpendicular to it', () => {
    for (const i of side) {
      const [nx, ny] = [surface.normals![i * 3]!, surface.normals![i * 3 + 1]!];
      const [tx, ty] = [surface.tangents![i * 4]!, surface.tangents![i * 4 + 1]!];
      expect(Math.hypot(nx, ny)).toBeCloseTo(1, 5);
      expect(nx * tx + ny * ty).toBeCloseTo(0, 5);
    }
  });

  it('spans each side quad over the full depth', () => {
    const z = axis(surface, 2);
    expect(side.slice(0, 4).map((i) => z[i])).toEqual([-HALF_DEPTH, -HALF_DEPTH, HALF_DEPTH, HALF_DEPTH]);
  });
});

describe('buildTextMeshSurface placement', () => {
  const glyph = glyphOf('H');
  const inkLeft = glyph.min.x;
  const lineWidth = shapedTextSizeWidthPx(shapedLines('H').lines[0]!.widthPx) * PIXEL_SIZE;

  it('starts a left-aligned line at the pen origin', () => {
    expect(extent(axis(surfaceOf('H', { horizontal_alignment: LEFT }), 0)).min).toBeCloseTo(inkLeft, 6);
  });

  it('centres a line on its whole advance width', () => {
    expect(extent(axis(surfaceOf('H'), 0)).min).toBeCloseTo(inkLeft - lineWidth / 2, 6);
  });

  it('ends a right-aligned line at the pen origin', () => {
    expect(extent(axis(surfaceOf('H', { horizontal_alignment: RIGHT }), 0)).min).toBeCloseTo(
      inkLeft - lineWidth,
      6
    );
  });

  describe('vertical alignment', () => {
    const lines = shapedLines('H');
    const topOfInk = -glyph.min.y;
    const topAtTop = topOfInk - lines.baselineOffsetPx * PIXEL_SIZE;
    const blockHeight = lines.linePitchPx * PIXEL_SIZE;

    it('hangs the first line from the origin by its ascent for TOP', () => {
      expect(extent(axis(surfaceOf('H', { vertical_alignment: TOP }), 1)).max).toBeCloseTo(topAtTop, 6);
    });

    it('moves the block up by half its height for CENTER', () => {
      expect(extent(axis(surfaceOf('H'), 1)).max).toBeCloseTo(topAtTop + blockHeight / 2, 6);
    });

    it('moves the block up by its whole height for BOTTOM', () => {
      expect(extent(axis(surfaceOf('H', { vertical_alignment: BOTTOM }), 1)).max).toBeCloseTo(
        topAtTop + blockHeight,
        6
      );
    });
  });

  it('moves the text by offset times pixel_size', () => {
    const base = surfaceOf('H');
    const moved = surfaceOf('H', { offset: 'Vector2(10, 20)' });
    expect(extent(axis(moved, 0)).min - extent(axis(base, 0)).min).toBeCloseTo(0.1, 6);
    expect(extent(axis(moved, 1)).max - extent(axis(base, 1)).max).toBeCloseTo(0.2, 6);
  });

  it('scales the glyph by pixel_size and leaves the depth alone', () => {
    const base = surfaceOf('H');
    const scaled = surfaceOf('H', { pixel_size: '0.02' });
    const width = (surface: GodotSurface) => extent(axis(surface, 0)).max - extent(axis(surface, 0)).min;
    expect(width(scaled) / width(base)).toBeCloseTo(2, 5);
    expect(extent(axis(scaled, 2))).toEqual(extent(axis(base, 2)));
  });

  it('puts the second line one line pitch, with line_spacing, below the first', () => {
    const surface = surfaceOf('H\\nH', { line_spacing: '10' });
    const y = axis(surface, 1);
    const half = y.length / 2;
    const pitch = shapedLines('H\nH', 10).linePitchPx * PIXEL_SIZE;
    expect(extent(y.slice(0, half)).max - extent(y.slice(half)).max).toBeCloseTo(pitch, 6);
  });

  it('shapes the upper case of the text when uppercase is set', () => {
    expect(Array.from(surfaceOf('h', { uppercase: 'true' }).positions)).toEqual(
      Array.from(surfaceOf('H').positions)
    );
  });

  it('breaks a line wider than width at a space under word autowrap', () => {
    const wrapped = surfaceOf('H H', { width: '60', autowrap_mode: String(AutowrapMode.AUTOWRAP_WORD) });
    const unwrapped = surfaceOf('H H');
    const heightOf = (surface: GodotSurface) => extent(axis(surface, 1)).max - extent(axis(surface, 1)).min;
    expect(heightOf(wrapped)).toBeGreaterThan(
      heightOf(unwrapped) + shapedLines('H').linePitchPx * PIXEL_SIZE * 0.9
    );
  });
});

describe('buildTextMeshSurface justification', () => {
  it('widens the spaces of a single line to width under HORIZONTAL_ALIGNMENT_FILL', () => {
    const raw = { width: '300', horizontal_alignment: FILL };
    const justified = extent(axis(surfaceOf('H H', raw), 0));
    const centred = extent(axis(surfaceOf('H H'), 0));
    const slackPx = 300 - shapedLines('H H').lines[0]!.widthPx;
    expect(justified.max - justified.min - (centred.max - centred.min)).toBeCloseTo(slackPx * PIXEL_SIZE, 5);
  });
});

describe('buildTextMeshSurface missing glyph', () => {
  const missing = 'Ж';
  const codepoint = missing.codePointAt(0)!;

  it('draws a hex code box quad of the size the text server reserves, at z = 0', () => {
    const surface = surfaceOf(missing, { horizontal_alignment: LEFT, vertical_alignment: TOP });
    const box = hexCodeBoxAdvanceSize(FONT_SIZE, codepoint);
    const ascent = shapedLines(missing).baselineOffsetPx;
    expect(axis(surface, 0)).toEqual(
      [0, 0, box.x * PIXEL_SIZE, box.x * PIXEL_SIZE].map((value) => expect.closeTo(value, 6))
    );
    expect(axis(surface, 1)).toEqual(
      [0, box.y * PIXEL_SIZE, box.y * PIXEL_SIZE, 0].map((value) =>
        expect.closeTo(value - ascent * PIXEL_SIZE, 6)
      )
    );
    expect(axis(surface, 2)).toEqual([0, 0, 0, 0]);
    expect(Array.from(surface.indices)).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('leaves the quad out of the box the UV spans', () => {
    const raw = { horizontal_alignment: LEFT };
    const withBox = uvAxis(surfaceOf(`H${missing}`, raw), 0);
    const without = uvAxis(surfaceOf('H', raw), 0);
    expect(withBox.slice(0, without.length)).toEqual(without);
  });
});

describe('buildTextMeshSurface glyph reuse', () => {
  function countingFace(): { face: TextMeshFace; contoursRead: () => number } {
    let reads = 0;
    const counting = {
      ...outlines,
      glyphContours: (index: number, fontSize: number) => {
        reads += 1;
        return outlines.glyphContours(index, fontSize);
      },
    };
    return { face: { outlines: counting, metrics: OPEN_SANS_FONT_METRICS }, contoursRead: () => reads };
  }

  const build = (text: string, face: TextMeshFace, raw: Record<string, string> = {}) =>
    buildTextMeshSurface(decodeTextMesh({ text: `"${text}"`, font_size: String(FONT_SIZE), ...raw }), face);

  it('reads the outline of a glyph once across builds of one font, so a keystroke adds only its own glyph', () => {
    const { face: counted, contoursRead } = countingFace();
    build('He', counted);
    build('Hel', counted);
    build('Hell', counted);
    expect(contoursRead()).toBe(3);
  });

  it('keeps the glyphs of two sizes of one font, so meshes at two sizes do not discard each other', () => {
    const { face: counted, contoursRead } = countingFace();
    build('H', counted, { font_size: '32' });
    build('H', counted, { font_size: '64' });
    build('H', counted, { font_size: '32' });
    expect(contoursRead()).toBe(2);
  });

  it('reads the outlines again when the pixel size changes, as the glyph meshes scale with it', () => {
    const { face: counted, contoursRead } = countingFace();
    build('H', counted);
    build('H', counted, { pixel_size: '0.02' });
    expect(contoursRead()).toBe(2);
  });
});
