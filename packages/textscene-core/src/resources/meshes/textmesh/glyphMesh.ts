/**
 * The mesh data of one glyph, ported from `TextMesh::_generate_glyph_mesh_data`
 * (`scene/resources/3d/primitive_meshes.cpp:3043-3202`): the contours of the outline as polygons
 * with conic and cubic arcs stepped at `curve_step`, each contour's length and direction, the bounds, and the
 * triangles that fill the glyph. A TextMesh reuses one glyph's data wherever the glyph repeats.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ContourPointTag } from '../../../godot/text/textServerEnums';
import type { Vector2 } from '../../../godot/math/vector';
import type { ContourPoint, GlyphContours } from '../../../r3f/controls/native/text/glyphContours';
import { doubledSignedArea, triangulateContours, type TriangulatedContour } from './triangulate';

/** A polygon vertex. A point on the curve is sharp, and a point stepped along an arc is smooth. */
export interface ContourVertex {
  point: Vector2;
  isSharp: boolean;
}

export interface ContourInfo {
  /** The length of the closed polygon, in the mesh's own units. */
  length: number;
  isCounterClockwise: boolean;
}

export interface GlyphMeshData {
  /** One polygon per contour, scaled by `pixel_size`, y down. */
  contours: ContourVertex[][];
  contoursInfo: ContourInfo[];
  /** Three corners per triangle, each wound counter-clockwise on a y-up page, so clockwise once y is negated. */
  triangles: Vector2[];
  min: Vector2;
  max: Vector2;
}

/** The step of `t` along an arc spans between a hundredth of the arc and half of it (`primitive_meshes.cpp:3096`). */
const MIN_ARC_STEP = 0.01;
const MAX_ARC_STEP = 0.5;

const toFloat = Math.fround;

function emptyGlyphMeshData(): GlyphMeshData {
  return {
    contours: [],
    contoursInfo: [],
    triangles: [],
    min: { x: Infinity, y: Infinity },
    max: { x: -Infinity, y: -Infinity },
  };
}

function midpoint(a: ContourPoint, b: ContourPoint): Vector2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** The step of `t` along an arc whose ends are `chord` px apart; Godot sums `t` in `float`. */
function arcStep(chord: number, curveStep: number): number {
  return toFloat(Math.min(MAX_ARC_STEP, Math.max(MIN_ARC_STEP, toFloat(curveStep / chord))));
}

/**
 * The points a conic arc adds between its two ends, `curve_step` px apart along the chord. A step of
 * 0.1 stops after nine points where a `double` gives ten.
 */
function conicArcPoints(
  start: Vector2,
  control: Vector2,
  end: Vector2,
  curveStep: number,
  pixelSize: number
): ContourVertex[] {
  const step = arcStep(Math.hypot(start.x - end.x, start.y - end.y), curveStep);
  const vertices: ContourVertex[] = [];
  for (let t = step; t < 1; t = toFloat(t + step)) {
    const omt = 1 - t;
    vertices.push({
      point: {
        x: (control.x + omt * omt * (start.x - control.x) + t * t * (end.x - control.x)) * pixelSize,
        y: (control.y + omt * omt * (start.y - control.y) + t * t * (end.y - control.y)) * pixelSize,
      },
      isSharp: false,
    });
  }
  return vertices;
}

/** One coordinate of `Math::bezier_interpolate` (`core/math/math_funcs.h:442-451`). */
function cubicCoordinate(start: number, control1: number, control2: number, end: number, t: number): number {
  const omt = 1 - t;
  return start * omt ** 3 + control1 * omt * omt * t * 3 + control2 * omt * t * t * 3 + end * t ** 3;
}

/** The points a cubic arc adds between its ends, stepped over the chord as a conic arc is (`:3128-3142`). */
function cubicArcPoints(
  [start, control1, control2, end]: readonly [Vector2, Vector2, Vector2, Vector2],
  curveStep: number,
  pixelSize: number
): ContourVertex[] {
  const step = arcStep(Math.hypot(start.x - end.x, start.y - end.y), curveStep);
  const vertices: ContourVertex[] = [];
  for (let t = step; t < 1; t = toFloat(t + step)) {
    vertices.push({
      point: {
        x: cubicCoordinate(start.x, control1.x, control2.x, end.x, t) * pixelSize,
        y: cubicCoordinate(start.y, control1.y, control2.y, end.y, t) * pixelSize,
      },
      isSharp: false,
    });
  }
  return vertices;
}

/**
 * The polygon of the contour from `start` to `end`, with each arc replaced by the points it steps
 * through (`:3067-3142`). FreeType orders a conic contour with an on-curve point or two control
 * points in a row, and a cubic one as on-curve, control, control, on-curve.
 */
function contourPolygon(
  points: readonly ContourPoint[],
  start: number,
  end: number,
  pixelSize: number,
  curveStep: number
): ContourVertex[] {
  const polygon: ContourVertex[] = [];
  for (let j = start; j <= end; j++) {
    const current = points[j]!;
    const previous = points[j === start ? end : j - 1]!;
    if (current.tag === ContourPointTag.ON) {
      polygon.push({ point: { x: current.x * pixelSize, y: current.y * pixelSize }, isSharp: true });
    } else if (current.tag === ContourPointTag.OFF_CUBIC) {
      // The arc takes the next control point too, so the loop steps past it.
      const second = j === end ? start : j + 1;
      const to = second === end ? start : second + 1;
      polygon.push(
        ...cubicArcPoints([previous, current, points[second]!, points[to]!], curveStep, pixelSize)
      );
      j++;
    } else {
      const next = points[j === end ? start : j + 1]!;
      // Two control points in a row meet at a virtual on-curve point between them.
      const from = previous.tag === ContourPointTag.ON ? previous : midpoint(previous, current);
      const to = next.tag === ContourPointTag.ON ? next : midpoint(current, next);
      polygon.push(...conicArcPoints(from, current, to, curveStep, pixelSize));
    }
  }
  return polygon;
}

/** Counter-clockwise on a y-up page, as polypartition reads the shoelace sum. */
function isCounterClockwise(polygon: readonly ContourVertex[]): boolean {
  return doubledSignedArea(polygon.map((vertex) => vertex.point)) > 0;
}

function toTriangulatedContour(polygon: readonly ContourVertex[]): TriangulatedContour {
  const points = polygon.map((vertex) => vertex.point);
  return { points, isHole: doubledSignedArea(points) < 0 };
}

function polygonLength(polygon: readonly ContourVertex[]): number {
  return polygon.reduce((length, { point }, i) => {
    const { point: next } = polygon[(i + 1) % polygon.length]!;
    return length + Math.hypot(next.x - point.x, next.y - point.y);
  }, 0);
}

/**
 * The mesh data of a glyph with `glyph` as its outline. A glyph with no outline, or with fewer than
 * three points, gets empty data, as in Godot (`:3055-3057`).
 */
export function buildGlyphMeshData(
  glyph: GlyphContours | null,
  pixelSize: number,
  curveStep: number
): GlyphMeshData {
  const data = emptyGlyphMeshData();
  if (!glyph || glyph.points.length < 3) return data;

  glyph.contourEnds.forEach((end, i) => {
    const start = i === 0 ? 0 : glyph.contourEnds[i - 1]! + 1;
    const polygon = contourPolygon(glyph.points, start, end, pixelSize, curveStep);
    if (polygon.length < 3) return;
    data.contours.push(glyph.isFillRight ? polygon : polygon.reverse());
  });

  for (const polygon of data.contours) {
    for (const { point } of polygon) {
      data.min = { x: Math.min(data.min.x, point.x), y: Math.min(data.min.y, point.y) };
      data.max = { x: Math.max(data.max.x, point.x), y: Math.max(data.max.y, point.y) };
    }
    data.contoursInfo.push({
      length: polygonLength(polygon),
      isCounterClockwise: isCounterClockwise(polygon),
    });
  }

  data.triangles = triangulateContours(data.contours.map(toTriangulatedContour));
  return data;
}
