/**
 * The path of a glyph outline: `FT_Outline_Decompose` (`ftoutln.c`) over the points and tags of
 * `GlyphContours`, so that the smooth rasteriser (`ftGrays.ts`) covers the contour FreeType decomposes.
 *
 * Portions ported from FreeType (FreeType License).
 * Copyright (c) 1996-2024 David Turner, Robert Wilhelm and Werner Lemberg.
 */

import { ContourPointTag } from '../../../../godot/text/textServerEnums';
import { FIXED_26_6_ONE } from './fontMetrics';
import { toOutlineUnits, type ContourPoint, type GlyphContours } from './glyphContours';
import type { Vector2 } from '../../../../godot/math/vector';

/** The calls of a canvas path that a glyph outline needs. */
export type PathSink = Pick<
  CanvasPath,
  'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'bezierCurveTo' | 'closePath'
>;

/**
 * The point where two control points in a row meet, as `FT_Outline_Decompose` takes it: the
 * halfway point in 1/64 px, which C's integer division floors in the rasteriser's y-up frame.
 */
function outlineMidpoint(a: Vector2, b: Vector2): Vector2 {
  return {
    x: Math.floor((toOutlineUnits(a.x) + toOutlineUnits(b.x)) / 2) / FIXED_26_6_ONE,
    y: Math.ceil((toOutlineUnits(a.y) + toOutlineUnits(b.y)) / 2) / FIXED_26_6_ONE,
  };
}

/**
 * Traces the contour `first` to `last` of `points`. A contour that starts on a control point starts
 * at its last point when that is on the curve, and between the two control points otherwise.
 */
function traceContour(sink: PathSink, points: readonly ContourPoint[], first: number, last: number): void {
  let limit = last;
  let index = first;
  const firstPoint = points[first]!;
  let start: Vector2 = firstPoint;
  if (firstPoint.tag === ContourPointTag.OFF_CONIC) {
    const lastPoint = points[last]!;
    if (lastPoint.tag === ContourPointTag.ON) {
      start = lastPoint;
      limit--;
    } else {
      start = outlineMidpoint(firstPoint, lastPoint);
    }
    // The first point is read again, as the first control point.
    index--;
  }
  sink.moveTo(start.x, start.y);

  while (index < limit) {
    index++;
    const current = points[index]!;
    if (current.tag === ContourPointTag.ON) {
      sink.lineTo(current.x, current.y);
    } else if (current.tag === ContourPointTag.OFF_CONIC) {
      let control: Vector2 = current;
      // A run of control points ends on an on-curve point; each pair meets at its midpoint.
      while (true) {
        if (index >= limit) {
          sink.quadraticCurveTo(control.x, control.y, start.x, start.y);
          sink.closePath();
          return;
        }
        index++;
        const next = points[index]!;
        if (next.tag === ContourPointTag.ON) {
          sink.quadraticCurveTo(control.x, control.y, next.x, next.y);
          break;
        }
        const middle = outlineMidpoint(control, next);
        sink.quadraticCurveTo(control.x, control.y, middle.x, middle.y);
        control = next;
      }
    } else {
      const firstControl = points[index]!;
      const secondControl = points[index + 1]!;
      index += 2;
      const end = index <= limit ? points[index]! : start;
      sink.bezierCurveTo(firstControl.x, firstControl.y, secondControl.x, secondControl.y, end.x, end.y);
      if (index > limit) {
        sink.closePath();
        return;
      }
    }
  }
  sink.closePath();
}

/**
 * Adds every contour of `contours` to `sink`, moved by `(originX, originY)`. The midpoints land on
 * the 1/64 px grid of the moved outline, so a move by whole pixels keeps the shape.
 */
export function traceGlyphContours(
  sink: PathSink,
  { points, contourEnds }: GlyphContours,
  originX: number,
  originY: number
): void {
  const moved = points.map((point) => ({ ...point, x: originX + point.x, y: originY + point.y }));
  let first = 0;
  for (const last of contourEnds) {
    traceContour(sink, moved, first, last);
    first = last + 1;
  }
}
