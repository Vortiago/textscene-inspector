/**
 * IUP, the TrueType instruction that moves the points no instruction touched on one axis between
 * the touched points around them on their contour (`ttinterp.c`, `Ins_IUP` and its worker).
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ftDivFix, ftMulFix } from '../fontMetrics';
import { toUint16 } from '../../../../../godot/variant/intWidth';
import type { ExecContext } from './ttExecContext';
import { TAG_TOUCH_X, TAG_TOUCH_Y } from './ttZone';

/** One axis of the glyph zone: original, current and unscaled coordinates. */
interface Axis {
  readonly org: Float64Array;
  readonly cur: Float64Array;
  readonly orus: Float64Array;
  readonly pointCount: number;
}

/** `iup_worker_shift_`: shifts points `first` to `last`, but `touched`, by the move of the one touched point. */
function shiftByTouched(axis: Axis, first: number, last: number, touched: number): void {
  const delta = axis.cur[touched]! - axis.org[touched]!;
  if (delta === 0) return;
  for (let point = first; point <= last; point++)
    if (point !== touched) axis.cur[point] = axis.cur[point]! + delta;
}

/**
 * `iup_worker_interpolate_`: moves points `first` to `last` between the touched points `ref1` and
 * `ref2`. A point outside them in its original place moves as the nearer one did. A point between
 * them keeps its unscaled place between their current ones, or snaps to them when they coincide.
 */
function interpolateBetween(axis: Axis, first: number, last: number, ref1: number, ref2: number): void {
  if (first > last || ref1 >= axis.pointCount || ref2 >= axis.pointCount) return;
  const [low, high] = axis.orus[ref1]! > axis.orus[ref2]! ? [ref2, ref1] : [ref1, ref2];
  const { org, cur, orus } = axis;
  const [orus1, orus2] = [orus[low]!, orus[high]!];
  const [org1, org2] = [org[low]!, org[high]!];
  const [cur1, cur2] = [cur[low]!, cur[high]!];
  const isSnap = cur1 === cur2 || orus1 === orus2;
  let scale: number | null = null;
  for (let point = first; point <= last; point++) {
    const x = org[point]!;
    if (x <= org1) cur[point] = x + (cur1 - org1);
    else if (x >= org2) cur[point] = x + (cur2 - org2);
    else if (isSnap) cur[point] = cur1;
    else {
      scale ??= ftDivFix(cur2 - cur1, orus2 - orus1);
      cur[point] = cur1 + ftMulFix(orus[point]! - orus1, scale);
    }
  }
}

/**
 * The IUP of one contour, from `first` to `last`: each run of untouched points between two touched
 * ones interpolates, and a contour with one touched point shifts by its move.
 */
function interpolateContour(axis: Axis, tags: Uint8Array, mask: number, first: number, last: number): void {
  let point = first;
  while (point <= last && (tags[point]! & mask) === 0) point++;
  if (point > last) return;
  const firstTouched = point;
  let lastTouched = point;
  for (point++; point <= last; point++) {
    if ((tags[point]! & mask) === 0) continue;
    interpolateBetween(axis, lastTouched + 1, point - 1, lastTouched, point);
    lastTouched = point;
  }
  if (lastTouched === firstTouched) {
    shiftByTouched(axis, first, last, lastTouched);
    return;
  }
  interpolateBetween(axis, toUint16(lastTouched + 1), last, lastTouched, firstTouched);
  if (firstTouched > 0) interpolateBetween(axis, first, firstTouched - 1, lastTouched, firstTouched);
}

/** The backward compatibility value once IUP has run on both axes. */
const POST_IUP = 0x7;

/**
 * IUP[y] and IUP[x]. Backward compatibility records each axis it runs on, and once both have run
 * it ignores every later IUP.
 */
export function interpolateUntouchedPoints(exc: ExecContext): void {
  if (exc.backwardCompatibility === POST_IUP) return;
  const isX = (exc.opcode & 1) !== 0;
  if (exc.backwardCompatibility) exc.backwardCompatibility |= isX ? 2 : 1;
  const { pts } = exc;
  if (pts.contourCount === 0) return;
  const axis: Axis = isX
    ? { org: pts.orgX, cur: pts.curX, orus: pts.orusX, pointCount: pts.pointCount }
    : { org: pts.orgY, cur: pts.curY, orus: pts.orusY, pointCount: pts.pointCount };
  const mask = isX ? TAG_TOUCH_X : TAG_TOUCH_Y;
  let first = 0;
  for (let contour = 0; contour < pts.contourCount; contour++) {
    let last = pts.contourEnds[contour]! - pts.firstPoint;
    if (last < 0 || last >= pts.pointCount) last = pts.pointCount - 1;
    interpolateContour(axis, pts.tags, mask, first, last);
    first = Math.max(first, last + 1);
  }
}
