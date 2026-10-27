/**
 * Collects the moves, lines and curves a glyph path draws into contours, in device space: 16.16
 * px with y up, as FreeType's `cf2_builder_*` callbacks receive them. A contour starts at the
 * first line or curve after a move, so a move that nothing follows draws nothing.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright 2007-2014 Adobe Systems Incorporated.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ContourPointTag } from '../../../../godot/text/textServerEnums';
import type { DevicePen } from './cffGlyphPath';
import type { ContourTag } from './glyphContours';

/** One contour: ON points at the ends of its segments, cubic control points between them. */
export interface CharstringContour {
  x: number[];
  y: number[];
  tags: ContourTag[];
}

export class ContourBuilder implements DevicePen {
  private startX = 0;
  private startY = 0;
  private open: CharstringContour | null = null;

  /** Every contour of the glyph is added to `contours`, which a `seac` accent and base share. */
  constructor(private readonly contours: CharstringContour[]) {}

  moveTo(x: number, y: number): void {
    this.startX = x;
    this.startY = y;
    this.open = null;
  }

  lineTo(x: number, y: number): void {
    const contour = this.contour();
    contour.x.push(x);
    contour.y.push(y);
    contour.tags.push(ContourPointTag.ON);
  }

  curveTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void {
    const contour = this.contour();
    contour.x.push(x1, x2, x3);
    contour.y.push(y1, y2, y3);
    contour.tags.push(ContourPointTag.OFF_CUBIC, ContourPointTag.OFF_CUBIC, ContourPointTag.ON);
  }

  /** The open contour, which the first draw after a move starts at the move's point. */
  private contour(): CharstringContour {
    if (!this.open) {
      this.open = { x: [this.startX], y: [this.startY], tags: [ContourPointTag.ON] };
      this.contours.push(this.open);
    }
    return this.open;
  }
}
