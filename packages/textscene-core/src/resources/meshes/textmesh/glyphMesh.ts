/**
 * The mesh data of one glyph, ported from `TextMesh::_generate_glyph_mesh_data`
 * (`scene/resources/3d/primitive_meshes.cpp:3043-3202`): the contours of the outline as polygons
 * with conic arcs stepped at `curve_step`, each contour's length and direction, the bounds, and the
 * triangles that fill the glyph. A TextMesh reuses one glyph's data wherever the glyph repeats.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ContourPointTag } from '../../../godot/text/textServerEnums';
import type { Vector2 } from '../../../godot/math/vector';
import type { ContourPoint, GlyphContours } from '../../../r3f/controls/native/text/sfntGlyf';
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

/**
 * The points a conic arc adds between its two ends, `curve_step` px apart along the chord. Godot
 * sums `t` in `float`, so a step of 0.1 stops after nine points where a `double` gives ten.
 */
function arcPoints(
  start: Vector2,
  control: Vector2,
  end: Vector2,
  curveStep: number,
  pixelSize: number
): ContourVertex[] {
  const chord = Math.hypot(start.x - end.x, start.y - end.y);
  const step = toFloat(Math.min(MAX_ARC_STEP, Math.max(MIN_ARC_STEP, toFloat(curveStep / chord))));
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

/** The polygon of the contour from `start` to `end`, with each control point replaced by the arc it bends (`:3067-3120`). */
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
    if (current.tag === ContourPointTag.ON) {
      polygon.push({ point: { x: current.x * pixelSize, y: current.y * pixelSize }, isSharp: true });
      continue;
    }
    const previous = points[j === start ? end : j - 1]!;
    const next = points[j === end ? start : j + 1]!;
    // Two control points in a row meet at a virtual on-curve point between them.
    const from = previous.tag === ContourPointTag.ON ? previous : midpoint(previous, current);
    const to = next.tag === ContourPointTag.ON ? next : midpoint(current, next);
    polygon.push(...arcPoints(from, current, to, curveStep, pixelSize));
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
