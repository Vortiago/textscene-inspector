/**
 * The TrueType instructions that shift points by a reference point's move, or by a distance, and
 * that interpolate, untouch, flip and delta them (`ttinterp.c`, `Ins_FLIPPT` to `Ins_UTP` and
 * `Ins_DELTAP`). Each takes the stack index `a` of its first argument.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ftMulDiv, ftMulFix } from '../fontMetrics';
import { toUint16 } from '../../../../../godot/variant/intWidth';
import { TAG_TOUCH_X, TAG_TOUCH_Y, type GlyphZone } from '../glyphHinting';
import { mulFix14 } from './ttArithmetic';
import { POST_IUP, type ExecContext } from './ttExecContext';
import { GLYPH_ZONE, isAnyZoneTwilight, TWILIGHT_ZONE } from './ttGraphicsState';
import { deltaStep, deltaTarget, popDeltaPairs } from './ttStorageInstructions';

/** `FT_CURVE_TAG_ON`: the point is on the curve. */
const TAG_ON_CURVE = 0x01;

/** FLIPPT: turns each looped point between on and off the curve. */
export function flipPoints(exc: ExecContext, a: number): void {
  const count = exc.popLoop();
  if (count < 0) return;
  if (exc.backwardCompatibility !== POST_IUP) {
    for (let k = 0; k < count; k++) {
      const point = exc.loopPoint(a, k);
      if (point < exc.pts.pointCount) exc.pts.tags[point] = exc.pts.tags[point]! ^ TAG_ON_CURVE;
    }
  }
  exc.graphicsState.loop = 1;
}

/** FLIPRGON and FLIPRGOFF: puts a range of points on the curve, or off it for the odd opcode. */
export function flipRange(exc: ExecContext, a: number): void {
  if (exc.backwardCompatibility === POST_IUP) return;
  const last = toUint16(exc.stack[a + 1]!);
  const first = toUint16(exc.stack[a]!);
  const { pts } = exc;
  if (last >= pts.pointCount || first >= pts.pointCount) return;
  const isOn = (exc.opcode & 1) !== 0;
  for (let point = first; point <= last; point++)
    pts.tags[point] = isOn ? pts.tags[point]! | TAG_ON_CURVE : pts.tags[point]! & ~TAG_ON_CURVE;
}

/** A displacement, and the zone and point it was measured on. */
interface Displacement {
  dx: number;
  dy: number;
  zone: GlyphZone;
  point: number;
}

/**
 * `Compute_Point_Displacement`: how far the instructions have moved rp1 of zp0 for an odd opcode,
 * or rp2 of zp1, along the free vector. Null for a reference past its zone.
 */
function referenceDisplacement(exc: ExecContext): Displacement | null {
  const isRp1 = (exc.opcode & 1) !== 0;
  const zone = isRp1 ? exc.zp0 : exc.zp1;
  const point = isRp1 ? exc.graphicsState.rp1 : exc.graphicsState.rp2;
  if (point >= zone.pointCount) return null;
  const distance = exc.project(zone.curX[point]! - zone.orgX[point]!, zone.curY[point]! - zone.orgY[point]!);
  return { dx: ftMulFix(distance, exc.moveVector.x), dy: ftMulFix(distance, exc.moveVector.y), zone, point };
}

/**
 * `Move_Zp2_Point`: shifts a point of zp2 on each axis the free vector has, with the backward
 * compatibility blocks of a move.
 */
function shiftPoint(exc: ExecContext, point: number, dx: number, dy: number, isTouching: boolean): void {
  const { zp2, graphicsState } = exc;
  if (graphicsState.freeVector.x !== 0) {
    if (!exc.backwardCompatibility) zp2.curX[point] = zp2.curX[point]! + dx;
    if (isTouching) zp2.tags[point] = zp2.tags[point]! | TAG_TOUCH_X;
  }
  if (graphicsState.freeVector.y !== 0) {
    if (exc.backwardCompatibility !== POST_IUP) zp2.curY[point] = zp2.curY[point]! + dy;
    if (isTouching) zp2.tags[point] = zp2.tags[point]! | TAG_TOUCH_Y;
  }
}

/** Whether `point` of zp2 is the reference the displacement was measured on, which no shift moves. */
function isReference(exc: ExecContext, { zone, point }: Displacement, candidate: number): boolean {
  return zone.curX === exc.zp2.curX && point === candidate;
}

/** SHP: shifts each looped point by the reference point's move. */
export function shiftPoints(exc: ExecContext, a: number): void {
  const count = exc.popLoop();
  if (count < 0) return;
  const displacement = referenceDisplacement(exc);
  // FreeType returns here without resetting the loop.
  if (!displacement) return;
  for (let k = 0; k < count; k++) {
    const point = exc.loopPoint(a, k);
    if (point < exc.zp2.pointCount) shiftPoint(exc, point, displacement.dx, displacement.dy, true);
  }
  exc.graphicsState.loop = 1;
}

/** SHC: shifts a contour by the reference point's move. The twilight zone counts as one contour. */
export function shiftContour(exc: ExecContext, a: number): void {
  const contour = toUint16(exc.stack[a]!);
  const { zp2, graphicsState } = exc;
  const isTwilight = graphicsState.gep2 === TWILIGHT_ZONE;
  if (contour >= (isTwilight ? 1 : zp2.contourCount)) return;
  const displacement = referenceDisplacement(exc);
  if (!displacement) return;
  const start = contour === 0 ? 0 : toUint16(zp2.contourEnds[contour - 1]! + 1 - zp2.firstPoint);
  const limit = isTwilight ? zp2.pointCount : toUint16(zp2.contourEnds[contour]! + 1 - zp2.firstPoint);
  for (let point = start; point < limit; point++)
    if (!isReference(exc, displacement, point))
      shiftPoint(exc, point, displacement.dx, displacement.dy, true);
}

/**
 * SHZ: shifts a whole zone by the reference point's move, without touching it. The glyph zone's
 * shift stops before its phantom points, at the end of its last contour.
 */
export function shiftZone(exc: ExecContext, a: number): void {
  const zoneNumber = exc.stack[a]!;
  if (zoneNumber < 0 || zoneNumber >= 2) return;
  const displacement = referenceDisplacement(exc);
  if (!displacement) return;
  const { zp2, graphicsState } = exc;
  let limit = 0;
  if (graphicsState.gep2 === TWILIGHT_ZONE) limit = zp2.pointCount;
  else if (graphicsState.gep2 === GLYPH_ZONE && zp2.contourCount > 0)
    limit = toUint16(zp2.contourEnds[zp2.contourCount - 1]! + 1);
  for (let point = 0; point < limit; point++)
    if (!isReference(exc, displacement, point))
      shiftPoint(exc, point, displacement.dx, displacement.dy, false);
}

/**
 * Whether backward compatibility lets a y move of `point` of `zone` through before IUP: a
 * composite's, or one of a point already touched in y. SHPIX and DELTAP share it.
 */
function isYMoveAllowed(exc: ExecContext, zone: GlyphZone, point: number): boolean {
  if (exc.backwardCompatibility === POST_IUP) return false;
  return (exc.isComposite && exc.graphicsState.freeVector.y !== 0) || (zone.tags[point]! & TAG_TOUCH_Y) !== 0;
}

/**
 * SHPIX: shifts each looped point by a pixel distance along the free vector. Backward
 * compatibility lets only a y shift through, as for DELTAP, and in the twilight zone a y shift of
 * any point.
 */
export function shiftPointsByPixels(exc: ExecContext, a: number): void {
  const isInTwilight = isAnyZoneTwilight(exc.graphicsState);
  const count = exc.popLoop();
  if (count < 0) return;
  const distance = exc.stack[a]!;
  const dx = mulFix14(distance, exc.graphicsState.freeVector.x);
  const dy = mulFix14(distance, exc.graphicsState.freeVector.y);
  for (let k = 0; k < count; k++) {
    const point = exc.loopPoint(a, k);
    if (point >= exc.zp2.pointCount) continue;
    if (!exc.backwardCompatibility) shiftPoint(exc, point, dx, dy, true);
    else if (isInTwilight || isYMoveAllowed(exc, exc.zp2, point)) shiftPoint(exc, point, 0, dy, true);
  }
  exc.graphicsState.loop = 1;
}

/**
 * The coordinates IP measures original distances on: the original points in the twilight zone,
 * else the unscaled ones. FreeType leaves the unscaled distance unscaled, as IP needs only its
 * ratio, but for a zero range it moves by it.
 */
function originalCoordinatesOf(
  zone: GlyphZone,
  isInTwilight: boolean
): readonly [Float64Array, Float64Array] {
  return isInTwilight ? [zone.orgX, zone.orgY] : [zone.orusX, zone.orusY];
}

/**
 * IP: moves each looped point so that it keeps its place between rp1 and rp2. With rp2 past its
 * zone, or rp1 and rp2 at one original place, a point keeps its original distance from rp1.
 */
export function interpolatePoints(exc: ExecContext, a: number): void {
  const count = exc.popLoop();
  if (count < 0) return;
  const { zp0, zp1, zp2, graphicsState } = exc;
  const { rp1, rp2 } = graphicsState;
  if (rp1 < zp0.pointCount) {
    const isInTwilight = isAnyZoneTwilight(graphicsState);
    const [baseX, baseY] = originalCoordinatesOf(zp0, isInTwilight);
    let originalRange = 0;
    let currentRange = 0;
    if (rp2 < zp1.pointCount) {
      const [rangeX, rangeY] = originalCoordinatesOf(zp1, isInTwilight);
      originalRange = exc.dualProject(rangeX[rp2]! - baseX[rp1]!, rangeY[rp2]! - baseY[rp1]!);
      currentRange = exc.project(zp1.curX[rp2]! - zp0.curX[rp1]!, zp1.curY[rp2]! - zp0.curY[rp1]!);
    }
    const [pointX, pointY] = originalCoordinatesOf(zp2, isInTwilight);
    for (let k = 0; k < count; k++) {
      const point = exc.stack[a - 1 - k]!;
      if (point < 0 || point >= zp2.pointCount) continue;
      const original = exc.dualProject(pointX[point]! - baseX[rp1]!, pointY[point]! - baseY[rp1]!);
      const current = exc.project(zp2.curX[point]! - zp0.curX[rp1]!, zp2.curY[point]! - zp0.curY[rp1]!);
      let target = 0;
      if (original !== 0)
        target = originalRange !== 0 ? ftMulDiv(original, currentRange, originalRange) : original;
      exc.move(zp2, toUint16(point), target - current);
    }
  }
  graphicsState.loop = 1;
}

/** UTP: untouches a point on each axis the free vector has. */
export function untouchPoint(exc: ExecContext, a: number): void {
  const point = toUint16(exc.stack[a]!);
  const { zp0, graphicsState } = exc;
  if (point >= zp0.pointCount) return;
  let mask = 0xff;
  if (graphicsState.freeVector.x !== 0) mask &= ~TAG_TOUCH_X;
  if (graphicsState.freeVector.y !== 0) mask &= ~TAG_TOUCH_Y;
  zp0.tags[point] = zp0.tags[point]! & mask;
}

/** DELTAP1 to DELTAP3: moves a point of zp0 at one ppem, which backward compatibility allows as SHPIX does. */
export function deltaPoint(exc: ExecContext, a: number): void {
  const { zp0 } = exc;
  const pairCount = popDeltaPairs(exc, a);
  for (let pair = 0; pair < pairCount; pair++) {
    const step = deltaStep(exc, a, pair);
    const point = toUint16(deltaTarget(exc, a, pair));
    if (step === null || point >= zp0.pointCount) continue;
    if (!exc.backwardCompatibility || isYMoveAllowed(exc, zp0, point)) exc.move(zp0, point, step);
  }
}
