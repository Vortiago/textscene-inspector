/**
 * Turns the move, line and curve calls of a Type 2 charstring into contours, in the charstring's
 * 16.16 fixed-point units with y up. It is FreeType's `cf2_glyphpath` without hinting or darkening,
 * where every offset is zero and the queue of path elements reduces to drawing each one at once.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright 2007-2014 Adobe Systems Incorporated.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ContourPointTag } from '../../../../godot/text/textServerEnums';

type PointTag = (typeof ContourPointTag)[keyof typeof ContourPointTag];

/** One contour: ON points at the ends of its segments, cubic control points between them. */
export interface CharstringContour {
  x: number[];
  y: number[];
  tags: PointTag[];
}

export class GlyphPen {
  /** The pen starts at the origin whatever the charstring's first move says: `cf2_glyphpath_init` zeroes it. */
  private currentX = 0;
  private currentY = 0;
  private startX = 0;
  private startY = 0;
  private open: CharstringContour | null = null;

  /** Every contour of the glyph is added to `contours`, which a `seac` accent and base share. */
  constructor(private readonly contours: CharstringContour[]) {}

  moveTo(x: number, y: number): void {
    this.closeOpenPath();
    this.currentX = this.startX = x;
    this.currentY = this.startY = y;
  }

  /** A zero-length line adds no point (`cf2_glyphpath_lineTo`). */
  lineTo(x: number, y: number): void {
    if (x === this.currentX && y === this.currentY) return;
    const contour = this.contour();
    contour.x.push(x);
    contour.y.push(y);
    contour.tags.push(ContourPointTag.ON);
    this.currentX = x;
    this.currentY = y;
  }

  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    const contour = this.contour();
    contour.x.push(x1, x2, x3);
    contour.y.push(y1, y2, y3);
    contour.tags.push(ContourPointTag.OFF_CUBIC, ContourPointTag.OFF_CUBIC, ContourPointTag.ON);
    this.currentX = x3;
    this.currentY = y3;
  }

  /** Ends the open contour with a line back to its start (`cf2_glyphpath_closeOpenPath`). */
  closeOpenPath(): void {
    if (!this.open) return;
    this.lineTo(this.startX, this.startY);
    this.open = null;
  }

  /** The open contour, which the first draw after a move starts at the move's point. */
  private contour(): CharstringContour {
    if (!this.open) {
      this.open = { x: [this.currentX], y: [this.currentY], tags: [ContourPointTag.ON] };
      this.contours.push(this.open);
    }
    return this.open;
  }
}
