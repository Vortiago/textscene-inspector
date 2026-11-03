/**
 * The TrueType instructions that move a point to a distance or a place, and the measures they
 * share (`ttinterp.c`, `Ins_GC` to `Ins_MD` and `Ins_MSIRP` to `Ins_ALIGNPTS`). A point past its
 * zone makes the instruction do nothing but what it does to the reference points. Each takes the
 * stack index `a` of its first argument.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ftMulDiv, ftMulFix } from '../fontMetrics';
import { toUint16 } from '../../../../../godot/variant/intWidth';
import { isOutside, mulFix14 } from './ttArithmetic';
import type { ExecContext } from './ttExecContext';
import { TWILIGHT_ZONE } from './ttGraphicsState';
import { TAG_TOUCH_BOTH, type GlyphZone } from './ttZone';

/** GC: the projection of a current point, or of an original one along the dual vector for an odd opcode. */
export function getCoordinate(exc: ExecContext, a: number): void {
  const point = exc.stack[a]!;
  const { zp2 } = exc;
  if (isOutside(point, zp2.pointCount)) exc.stack[a] = 0;
  else if ((exc.opcode & 1) !== 0) exc.stack[a] = exc.dualProject(zp2.orgX[point]!, zp2.orgY[point]!);
  else exc.stack[a] = exc.project(zp2.curX[point]!, zp2.curY[point]!);
}

/** SCFS: moves a point so that its projection is the value on the stack. */
export function setCoordinateFromStack(exc: ExecContext, a: number): void {
  const point = toUint16(exc.stack[a]!);
  const { zp2 } = exc;
  if (point >= zp2.pointCount) return;
  exc.move(zp2, point, exc.stack[a + 1]! - exc.project(zp2.curX[point]!, zp2.curY[point]!));
  // A twilight point keeps its new place as its original one, as Microsoft's rasteriser does.
  if (exc.graphicsState.gep2 === TWILIGHT_ZONE) {
    zp2.orgX[point] = zp2.curX[point]!;
    zp2.orgY[point] = zp2.curY[point]!;
  }
}

/**
 * The distance of two points before hinting along the dual vector: from the unscaled points, or
 * from the original ones when either zone is the twilight zone, which has no unscaled points.
 */
function originalDistance(
  exc: ExecContext,
  from: GlyphZone,
  fromPoint: number,
  to: GlyphZone,
  toPoint: number
): number {
  const { gep0, gep1 } = exc.graphicsState;
  if (gep0 === TWILIGHT_ZONE || gep1 === TWILIGHT_ZONE)
    return exc.dualProject(
      from.orgX[fromPoint]! - to.orgX[toPoint]!,
      from.orgY[fromPoint]! - to.orgY[toPoint]!
    );
  const unscaled = exc.dualProject(
    from.orusX[fromPoint]! - to.orusX[toPoint]!,
    from.orusY[fromPoint]! - to.orusY[toPoint]!
  );
  return ftMulFix(unscaled, exc.unscaledDistanceScale);
}

/** The current distance of two points along the projection vector. */
function currentDistance(
  exc: ExecContext,
  from: GlyphZone,
  fromPoint: number,
  to: GlyphZone,
  toPoint: number
): number {
  return exc.project(from.curX[fromPoint]! - to.curX[toPoint]!, from.curY[fromPoint]! - to.curY[toPoint]!);
}

/** MD: the current distance of two points for an odd opcode, else their distance before hinting. */
export function measureDistance(exc: ExecContext, a: number): void {
  const to = toUint16(exc.stack[a + 1]!);
  const from = toUint16(exc.stack[a]!);
  const { zp0, zp1 } = exc;
  if (from >= zp0.pointCount || to >= zp1.pointCount) exc.stack[a] = 0;
  else if ((exc.opcode & 1) !== 0) exc.stack[a] = currentDistance(exc, zp0, from, zp1, to);
  else exc.stack[a] = originalDistance(exc, zp0, from, zp1, to);
}

/** The reference points a relative move leaves: rp1 at rp0, rp2 at the point, and rp0 too for the set-rp0 form. */
function setRelativeReferences(exc: ExecContext, point: number, isSettingRp0: boolean): void {
  const { graphicsState } = exc;
  graphicsState.rp1 = graphicsState.rp0;
  graphicsState.rp2 = point;
  if (isSettingRp0) graphicsState.rp0 = point;
}

/**
 * MSIRP: moves a point to a distance from rp0. A twilight point starts at rp0's original place,
 * moved by the distance, as Microsoft's rasteriser does.
 */
export function moveStackIndirectRelativePoint(exc: ExecContext, a: number): void {
  const point = toUint16(exc.stack[a]!);
  const distance = exc.stack[a + 1]!;
  const { zp0, zp1, graphicsState } = exc;
  if (point >= zp1.pointCount || graphicsState.rp0 >= zp0.pointCount) return;
  if (graphicsState.gep1 === TWILIGHT_ZONE) {
    zp1.orgX[point] = zp0.orgX[graphicsState.rp0]!;
    zp1.orgY[point] = zp0.orgY[graphicsState.rp0]!;
    exc.moveOriginal(zp1, point, distance);
    zp1.curX[point] = zp1.orgX[point]!;
    zp1.curY[point] = zp1.orgY[point]!;
  }
  exc.move(zp1, point, distance - currentDistance(exc, zp1, point, zp0, graphicsState.rp0));
  setRelativeReferences(exc, point, (exc.opcode & 1) !== 0);
}

/** MDAP: touches a point, and rounds its projection for an odd opcode. */
export function moveDirectAbsolutePoint(exc: ExecContext, a: number): void {
  const point = toUint16(exc.stack[a]!);
  const { zp0 } = exc;
  if (point >= zp0.pointCount) return;
  let distance = 0;
  if ((exc.opcode & 1) !== 0) {
    const projection = exc.project(zp0.curX[point]!, zp0.curY[point]!);
    distance = exc.round(projection) - projection;
  }
  exc.move(zp0, point, distance);
  exc.graphicsState.rp0 = exc.graphicsState.rp1 = point;
}

/**
 * MIAP: moves a point so that its projection is a control value, rounded and held by the cut-in
 * for an odd opcode. A twilight point first takes the control value along the free vector as its
 * original place, with no cut-in, as Microsoft's rasteriser does.
 */
export function moveIndirectAbsolutePoint(exc: ExecContext, a: number): void {
  const point = toUint16(exc.stack[a]!);
  const entry = exc.stack[a + 1]!;
  const { zp0, graphicsState } = exc;
  if (point < zp0.pointCount && !isOutside(entry, exc.controlValues.length)) {
    let distance = exc.controlValues[entry]!;
    if (graphicsState.gep0 === TWILIGHT_ZONE) {
      zp0.orgX[point] = zp0.curX[point] = mulFix14(distance, graphicsState.freeVector.x);
      zp0.orgY[point] = zp0.curY[point] = mulFix14(distance, graphicsState.freeVector.y);
    }
    const projection = exc.project(zp0.curX[point]!, zp0.curY[point]!);
    if ((exc.opcode & 1) !== 0) {
      if (Math.abs(distance - projection) > graphicsState.controlValueCutIn) distance = projection;
      distance = exc.round(distance);
    }
    exc.move(zp0, point, distance - projection);
  }
  graphicsState.rp0 = graphicsState.rp1 = point;
}

/** The single width for a distance within its cut-in of it, with the distance's sign; else the distance. */
function singleWidthOr(exc: ExecContext, distance: number, isWithinCutIn: boolean): number {
  if (!isWithinCutIn) return distance;
  const { singleWidthValue } = exc.graphicsState;
  return distance >= 0 ? singleWidthValue : 0 - singleWidthValue;
}

/** The distance raised to the minimum distance, with the sign of the original distance. */
function atLeastMinimum(exc: ExecContext, distance: number, originalSign: number): number {
  const { minimumDistance } = exc.graphicsState;
  if (originalSign >= 0) return Math.max(distance, minimumDistance);
  return Math.min(distance, 0 - minimumDistance);
}

/** The bits of the MDRP and MIRP opcodes: round, keep the minimum distance, set rp0. */
const RELATIVE_ROUND = 4;
const RELATIVE_MINIMUM_DISTANCE = 8;
const RELATIVE_SET_RP0 = 16;

/**
 * MDRP: moves a point to its distance from rp0 before hinting, with the single width, rounding
 * and minimum distance its opcode asks for.
 */
export function moveDirectRelativePoint(exc: ExecContext, a: number): void {
  const point = toUint16(exc.stack[a]!);
  const { zp0, zp1, graphicsState, opcode } = exc;
  if (point < zp1.pointCount && graphicsState.rp0 < zp0.pointCount) {
    const { singleWidthValue, singleWidthCutIn } = graphicsState;
    let original = originalDistance(exc, zp1, point, zp0, graphicsState.rp0);
    original = singleWidthOr(
      exc,
      original,
      singleWidthCutIn > 0 &&
        original < singleWidthValue + singleWidthCutIn &&
        original > singleWidthValue - singleWidthCutIn
    );
    let distance = (opcode & RELATIVE_ROUND) !== 0 ? exc.round(original) : original;
    if ((opcode & RELATIVE_MINIMUM_DISTANCE) !== 0) distance = atLeastMinimum(exc, distance, original);
    exc.move(zp1, point, distance - currentDistance(exc, zp1, point, zp0, graphicsState.rp0));
  }
  setRelativeReferences(exc, point, (opcode & RELATIVE_SET_RP0) !== 0);
}

/**
 * MIRP: moves a point to a control value's distance from rp0, entry -1 being zero. The value
 * takes the single width, the sign of the original distance with auto flip, and the original
 * distance past the cut-in when both points are in one zone.
 */
export function moveIndirectRelativePoint(exc: ExecContext, a: number): void {
  const point = toUint16(exc.stack[a]!);
  const entry = exc.stack[a + 1]! + 1;
  const { zp0, zp1, graphicsState, opcode } = exc;
  const { rp0 } = graphicsState;
  if (point < zp1.pointCount && !isOutside(entry, exc.controlValues.length + 1) && rp0 < zp0.pointCount) {
    let controlValue = entry === 0 ? 0 : exc.controlValues[entry - 1]!;
    const { singleWidthValue, singleWidthCutIn } = graphicsState;
    controlValue = singleWidthOr(
      exc,
      controlValue,
      Math.abs(controlValue - singleWidthValue) < singleWidthCutIn
    );
    // A twilight point starts at rp0's original place, moved by the value, as Microsoft's rasteriser does.
    if (graphicsState.gep1 === TWILIGHT_ZONE) {
      zp1.orgX[point] = zp1.curX[point] = zp0.orgX[rp0]! + mulFix14(controlValue, graphicsState.freeVector.x);
      zp1.orgY[point] = zp1.curY[point] = zp0.orgY[rp0]! + mulFix14(controlValue, graphicsState.freeVector.y);
    }
    const original = exc.dualProject(zp1.orgX[point]! - zp0.orgX[rp0]!, zp1.orgY[point]! - zp0.orgY[rp0]!);
    const current = currentDistance(exc, zp1, point, zp0, rp0);
    if (graphicsState.isAutoFlip && original < 0 !== controlValue < 0) controlValue = 0 - controlValue;
    let distance = controlValue;
    if ((opcode & RELATIVE_ROUND) !== 0) {
      if (
        graphicsState.gep0 === graphicsState.gep1 &&
        Math.abs(controlValue - original) > graphicsState.controlValueCutIn
      )
        distance = original;
      distance = exc.round(distance);
    }
    if ((opcode & RELATIVE_MINIMUM_DISTANCE) !== 0) distance = atLeastMinimum(exc, distance, original);
    exc.move(zp1, point, distance - current);
  }
  setRelativeReferences(exc, point, (opcode & RELATIVE_SET_RP0) !== 0);
}

/** ALIGNRP: moves each looped point onto rp0 along the projection vector. */
export function alignToReferencePoint(exc: ExecContext, a: number): void {
  const count = exc.popLoop();
  if (count < 0) return;
  const { zp0, zp1, graphicsState } = exc;
  if (graphicsState.rp0 < zp0.pointCount) {
    for (let k = 0; k < count; k++) {
      const point = exc.loopPoint(a, k);
      if (point < zp1.pointCount)
        exc.move(zp1, point, 0 - currentDistance(exc, zp1, point, zp0, graphicsState.rp0));
    }
  }
  graphicsState.loop = 1;
}

/** ALIGNPTS: moves two points to the middle of their projections, each half way. */
export function alignPoints(exc: ExecContext, a: number): void {
  const first = toUint16(exc.stack[a]!);
  const second = toUint16(exc.stack[a + 1]!);
  const { zp0, zp1 } = exc;
  if (first >= zp1.pointCount || second >= zp0.pointCount) return;
  const distance = Math.trunc(currentDistance(exc, zp0, second, zp1, first) / 2);
  exc.move(zp1, first, distance);
  exc.move(zp0, second, 0 - distance);
}

/** `19 * |sin| > |cos|`: lines that cross at less than about 3 degrees count as parallel. */
const GRAZING_TANGENT_INVERSE = 19;

/**
 * ISECT: moves a point to where line a, in zp1, crosses line b, in zp0, or to the middle of the
 * four points for lines that graze. FreeType moves it with no backward compatibility block.
 */
export function intersect(exc: ExecContext, a: number): void {
  const point = toUint16(exc.stack[a]!);
  const a0 = toUint16(exc.stack[a + 1]!);
  const a1 = toUint16(exc.stack[a + 2]!);
  const b0 = toUint16(exc.stack[a + 3]!);
  const b1 = toUint16(exc.stack[a + 4]!);
  const { zp0, zp1, zp2 } = exc;
  if (b0 >= zp0.pointCount || b1 >= zp0.pointCount || a0 >= zp1.pointCount || a1 >= zp1.pointCount) return;
  if (point >= zp2.pointCount) return;
  const dbx = zp0.curX[b1]! - zp0.curX[b0]!;
  const dby = zp0.curY[b1]! - zp0.curY[b0]!;
  const dax = zp1.curX[a1]! - zp1.curX[a0]!;
  const day = zp1.curY[a1]! - zp1.curY[a0]!;
  const dx = zp0.curX[b0]! - zp1.curX[a0]!;
  const dy = zp0.curY[b0]! - zp1.curY[a0]!;
  const discriminant = ftMulDiv(dax, 0 - dby, 0x40) + ftMulDiv(day, dbx, 0x40);
  const dotProduct = ftMulDiv(dax, dbx, 0x40) + ftMulDiv(day, dby, 0x40);
  if (GRAZING_TANGENT_INVERSE * Math.abs(discriminant) > Math.abs(dotProduct)) {
    const along = ftMulDiv(dx, 0 - dby, 0x40) + ftMulDiv(dy, dbx, 0x40);
    zp2.curX[point] = zp1.curX[a0]! + ftMulDiv(along, dax, discriminant);
    zp2.curY[point] = zp1.curY[a0]! + ftMulDiv(along, day, discriminant);
  } else {
    zp2.curX[point] = Math.trunc((zp1.curX[a0]! + zp1.curX[a1]! + zp0.curX[b0]! + zp0.curX[b1]!) / 4);
    zp2.curY[point] = Math.trunc((zp1.curY[a0]! + zp1.curY[a1]! + zp0.curY[b0]! + zp0.curY[b1]!) / 4);
  }
  zp2.tags[point] = zp2.tags[point]! | TAG_TOUCH_BOTH;
}
