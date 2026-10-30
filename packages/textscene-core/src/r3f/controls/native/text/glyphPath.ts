/**
 * The canvas path of a glyph outline: `FT_Outline_Decompose` (`ftoutln.c`) over the points and tags
 * of `GlyphContours`, so that a canvas strokes the very contour FreeType's stroker takes.
 *
 * Portions ported from FreeType (FreeType License).
 * Copyright (c) 1996-2024 David Turner, Robert Wilhelm and Werner Lemberg.
 */

import { ContourPointTag } from '../../../../godot/text/textServerEnums';
import { midpoint, type ContourPoint, type GlyphContours } from './glyphContours';
import type { Vector2 } from '../../../../godot/math/vector';

/** The calls of a canvas path that a glyph outline needs. */
type PathSink = Pick<CanvasPath, 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'bezierCurveTo' | 'closePath'>;

/**
 * Traces the contour `first` to `last` of `points`. A contour that starts on a control point starts
 * at its last point when that is on the curve, and between the two control points otherwise.
 */
function traceContour(
  sink: PathSink,
  points: readonly ContourPoint[],
  first: number,
  last: number,
  originX: number,
  originY: number
): void {
  const at = (point: Vector2): [number, number] => [originX + point.x, originY + point.y];
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
      start = midpoint(firstPoint, lastPoint);
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
        sink.quadraticCurveTo(...at(control), ...at(midpoint(control, next)));
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

/** Adds every contour of `contours` to `sink`, moved by `(originX, originY)`. */
export function traceGlyphContours(
  sink: PathSink,
  { points, contourEnds }: GlyphContours,
  originX: number,
  originY: number
): void {
  let first = 0;
  for (const last of contourEnds) {
    traceContour(sink, points, first, last, originX, originY);
    first = last + 1;
  }
}
