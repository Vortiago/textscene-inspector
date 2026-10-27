import { describe, expect, it } from 'vitest';
import { ContourPointTag } from '../../../godot/text/textServerEnums';
import { signedPolygonArea } from '../../../godot/math/polygonArea';
import { parseSfntOutlines } from '../../../r3f/controls/native/text/sfntOutlines';
import type { ContourPoint, GlyphContours } from '../../../r3f/controls/native/text/sfntGlyf';
import { fixtureFontBytes } from '../../../r3f/controls/native/text/sfntOutlines.testkit';
import { buildGlyphMeshData, type GlyphMeshData } from './glyphMesh';

const ON = ContourPointTag.ON;
const CONIC = ContourPointTag.OFF_CONIC;

function point(x: number, y: number, tag: ContourPoint['tag'] = ON): ContourPoint {
  return { x, y, tag };
}

/** One contour of `points`, wound as TrueType winds an outer contour unless `isFillRight` says otherwise. */
function oneContour(points: ContourPoint[], isFillRight = true): GlyphContours {
  return { points, contourEnds: [points.length - 1], isFillRight };
}

const xy = (data: GlyphMeshData, contour = 0) =>
  data.contours[contour]!.map((vertex) => [vertex.point.x, vertex.point.y]);

const SQUARE = (size: number, offset = 0): ContourPoint[] => [
  point(offset, offset),
  point(offset + size, offset),
  point(offset + size, offset + size),
  point(offset, offset + size),
];

describe('buildGlyphMeshData arcs', () => {
  // A conic arc from (0, 0) over (10, -10) to (20, 0), closed through (10, 5).
  const arch = [point(0, 0), point(10, -10, CONIC), point(20, 0), point(10, 5)];

  it('steps a conic arc at curve_step over the length of its chord', () => {
    // The chord is 20 px, so a curve_step of 5 steps t by 0.25: three interior points.
    const data = buildGlyphMeshData(oneContour(arch), 1, 5);
    expect(xy(data)).toEqual([
      [0, 0],
      [5, -3.75],
      [10, -5],
      [15, -3.75],
      [20, 0],
      [10, 5],
    ]);
  });

  it('marks the points on the curve sharp and the points of an arc smooth', () => {
    const data = buildGlyphMeshData(oneContour(arch), 1, 5);
    expect(data.contours[0]!.map((vertex) => vertex.isSharp)).toEqual([
      true,
      false,
      false,
      false,
      true,
      true,
    ]);
  });

  it('scales every point by pixel_size after it steps in font px', () => {
    const data = buildGlyphMeshData(oneContour(arch), 0.01, 5);
    expect(xy(data)).toEqual([
      [0, 0],
      [0.05, -0.0375],
      [0.1, -0.05],
      [0.15, -0.0375],
      [0.2, 0],
      [0.1, 0.05],
    ]);
  });

  it('caps the step at half the arc, so a curve_step beyond the chord adds one point', () => {
    const data = buildGlyphMeshData(oneContour(arch), 1, 40);
    expect(xy(data).slice(0, 3)).toEqual([
      [0, 0],
      [10, -5],
      [20, 0],
    ]);
  });

  it('puts the on-curve point between two successive control points, without adding it', () => {
    // Control points b and c share a virtual on-curve point at their middle, (10, -10).
    const contour = oneContour([
      point(0, 0),
      point(0, -10, CONIC),
      point(20, -10, CONIC),
      point(20, 0),
      point(10, 10),
    ]);
    const data = buildGlyphMeshData(contour, 1, 40);
    expect(xy(data)).toEqual([
      [0, 0],
      [2.5, -7.5],
      [17.5, -7.5],
      [20, 0],
      [10, 10],
    ]);
  });

  it('closes an arc that starts at the first point of the contour through the last', () => {
    // The first point is a control point, so its arc runs from the last point, on the curve.
    const contour = oneContour([point(10, -10, CONIC), point(20, 0), point(10, 5), point(0, 0)]);
    const data = buildGlyphMeshData(contour, 1, 40);
    expect(xy(data)).toEqual([
      [10, -5],
      [20, 0],
      [10, 5],
      [0, 0],
    ]);
  });
});

describe('buildGlyphMeshData contours', () => {
  it('keeps the winding of an outline whose fill is on the right', () => {
    const data = buildGlyphMeshData(oneContour(SQUARE(10)), 1, 0.5);
    expect(xy(data)).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
  });

  it('reverses the winding of an outline whose fill is on the left', () => {
    const data = buildGlyphMeshData(oneContour(SQUARE(10), false), 1, 0.5);
    expect(xy(data)).toEqual([
      [0, 10],
      [10, 10],
      [10, 0],
      [0, 0],
    ]);
  });

  it('drops a contour of fewer than three points', () => {
    const contours: GlyphContours = {
      points: [...SQUARE(10), point(20, 20), point(30, 30)],
      contourEnds: [3, 5],
      isFillRight: true,
    };
    expect(buildGlyphMeshData(contours, 1, 0.5).contours).toHaveLength(1);
  });

  it('records the bounds and the length of each contour', () => {
    const data = buildGlyphMeshData(oneContour(SQUARE(10, 2)), 1, 0.5);
    expect([data.min, data.max, data.contoursInfo[0]!.length]).toEqual([
      { x: 2, y: 2 },
      { x: 12, y: 12 },
      40,
    ]);
  });

  it('winds a hole clockwise and an outer contour counter-clockwise', () => {
    const hole = SQUARE(4, 3).reverse();
    const contours: GlyphContours = {
      points: [...SQUARE(10), ...hole],
      contourEnds: [3, 7],
      isFillRight: true,
    };
    const data = buildGlyphMeshData(contours, 1, 0.5);
    expect(data.contours.map((polygon) => signedPolygonArea(polygon.map((vertex) => vertex.point)))).toEqual([
      100, -16,
    ]);
    expect(data.contoursInfo.map((info) => info.isCounterClockwise)).toEqual([true, false]);
  });

  it('holds nothing for a glyph with no outline', () => {
    const data = buildGlyphMeshData(null, 1, 0.5);
    expect([data.contours, data.triangles, data.min, data.max]).toEqual([
      [],
      [],
      { x: Infinity, y: Infinity },
      { x: -Infinity, y: -Infinity },
    ]);
  });

  it('holds nothing for an outline of fewer than three points', () => {
    const data = buildGlyphMeshData(oneContour([point(0, 0), point(5, 5)]), 1, 0.5);
    expect(data.contours).toEqual([]);
  });
});

describe('buildGlyphMeshData triangles', () => {
  /** The area the triangles cover, each triangle's own sign kept. */
  function trianglesArea(data: GlyphMeshData): number {
    let area = 0;
    for (let i = 0; i < data.triangles.length; i += 3) {
      area += signedPolygonArea(data.triangles.slice(i, i + 3));
    }
    return area;
  }

  it('covers a square with two triangles', () => {
    const data = buildGlyphMeshData(oneContour(SQUARE(10)), 1, 0.5);
    expect([data.triangles.length / 3, trianglesArea(data)]).toEqual([2, 100]);
  });

  it('winds every triangle counter-clockwise, as the polygon partitioner does', () => {
    const data = buildGlyphMeshData(oneContour(SQUARE(10)), 1, 0.5);
    for (let i = 0; i < data.triangles.length; i += 3) {
      expect(signedPolygonArea(data.triangles.slice(i, i + 3))).toBeGreaterThan(0);
    }
  });

  it('leaves a hole uncovered', () => {
    const contours: GlyphContours = {
      points: [...SQUARE(10), ...SQUARE(4, 3).reverse()],
      contourEnds: [3, 7],
      isFillRight: true,
    };
    const data = buildGlyphMeshData(contours, 1, 0.5);
    expect(trianglesArea(data)).toBeCloseTo(84, 9);
  });

  const font = parseSfntOutlines(fixtureFontBytes('open-sans-semibold-subset.ttf'))!;

  it.each(['o', 'g', 'B', 'é', '8', 'H'])('covers exactly the area %s encloses', (char) => {
    const contours = font.glyphContours(font.glyphIndex(char.codePointAt(0)!), 64)!;
    const data = buildGlyphMeshData(contours, 1, 0.5);
    const enclosed = data.contours.reduce(
      (sum, polygon) => sum + signedPolygonArea(polygon.map((v) => v.point)),
      0
    );
    expect(trianglesArea(data)).toBeCloseTo(enclosed, 6);
    expect(enclosed).toBeGreaterThan(0);
  });
});
