/**
 * The canvas path of a glyph outline: `FT_Outline_Decompose` (`ftoutln.c`) over the points and tags
 * of `GlyphContours`, so that a canvas strokes the very contour FreeType's stroker takes.
 *
 * Portions ported from FreeType (FreeType License).
 * Copyright (c) 1996-2024 David Turner, Robert Wilhelm and Werner Lemberg.
 */

import { ContourPointTag } from '../../../../godot/text/textServerEnums';
import type { ContourPoint, GlyphContours } from './glyphContours';
import type { Vector2 } from '../../../../godot/math/vector';

/** The calls of a canvas path that a glyph outline needs. */
export type PathSink = Pick<
  CanvasPath,
  'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'bezierCurveTo' | 'closePath'
>;

/** 26.6 fixed point: FreeType holds an outline point in 1/64 px. */
const OUTLINE_UNITS_PER_PX = 64;

/**
 * The point where two control points in a row meet, as `FT_Outline_Decompose` takes it: the
 * halfway point in 1/64 px, which C's integer division floors in the rasteriser's y-up frame.
 */
function outlineMidpoint(a: Vector2, b: Vector2): Vector2 {
  const units = (px: number) => Math.round(px * OUTLINE_UNITS_PER_PX);
  return {
    x: Math.floor((units(a.x) + units(b.x)) / 2) / OUTLINE_UNITS_PER_PX,
    y: Math.ceil((units(a.y) + units(b.y)) / 2) / OUTLINE_UNITS_PER_PX,
  };
}

/**
 * Traces the contour `first` to `last` of `points`. A contour that starts on a control point starts
 * at its last point when that is on the curve, and between the two control points otherwise.
 */
function traceContour(sink: PathSink, points: readonly ContourPoint[], first: number, last: number): void {
  const at = (point: Vector2): [number, number] => [point.x, point.y];
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
  sink.moveTo(...at(start));

  while (index < limit) {
    index++;
    const current = points[index]!;
    if (current.tag === ContourPointTag.ON) {
      sink.lineTo(...at(current));
    } else if (current.tag === ContourPointTag.OFF_CONIC) {
      let control: Vector2 = current;
      // A run of control points ends on an on-curve point; each pair meets at its midpoint.
      while (true) {
        if (index >= limit) {
          sink.quadraticCurveTo(...at(control), ...at(start));
          sink.closePath();
          return;
        }
        index++;
        const next = points[index]!;
        if (next.tag === ContourPointTag.ON) {
          sink.quadraticCurveTo(...at(control), ...at(next));
          break;
        }
        sink.quadraticCurveTo(...at(control), ...at(outlineMidpoint(control, next)));
        control = next;
      }
    } else {
      const firstControl = points[index]!;
      const secondControl = points[index + 1]!;
      index += 2;
      sink.bezierCurveTo(
        ...at(firstControl),
        ...at(secondControl),
        ...at(index <= limit ? points[index]! : start)
      );
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
