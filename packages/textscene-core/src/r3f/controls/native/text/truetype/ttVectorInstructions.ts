/**
 * The TrueType instructions that set and read the projection, dual projection and free vectors
 * (`ttinterp.c`, `Ins_SxyTCA` to `Ins_GFV` and `Ins_SDPVTL`). Each takes the stack index `a` of
 * its first argument, and sets another vector rather than changing one in place.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { toInt16, toUint16 } from '../../../../../godot/variant/intWidth';
import type { GlyphZone } from '../glyphHinting';
import { F2DOT14_ONE, unitVectorAlong, type UnitVector } from './ttArithmetic';
import type { ExecContext } from './ttExecContext';
import { X_AXIS, Y_AXIS } from './ttGraphicsState';

/** The unit vector along `(x, y)`, or `previous` for the zero vector, which `Normalize` leaves as it is. */
function normalised(previous: UnitVector, x: number, y: number): UnitVector {
  return unitVectorAlong(x, y) ?? previous;
}

/**
 * The unit vector from point `to` of `toZone` to point `from` of `fromZone`, turned a quarter
 * counter-clockwise for an odd opcode. Two points at one place give the x axis, unturned.
 */
function vectorBetween(
  previous: UnitVector,
  isPerpendicular: boolean,
  [fromX, fromY]: readonly [Float64Array, Float64Array],
  from: number,
  [toX, toY]: readonly [Float64Array, Float64Array],
  to: number
): UnitVector {
  const dx = fromX[from]! - toX[to]!;
  const dy = fromY[from]! - toY[to]!;
  if (dx === 0 && dy === 0) return normalised(previous, F2DOT14_ONE, 0);
  return isPerpendicular ? normalised(previous, 0 - dy, dx) : normalised(previous, dx, dy);
}

const currentPoints = (zone: GlyphZone) => [zone.curX, zone.curY] as const;
const originalPoints = (zone: GlyphZone) => [zone.orgX, zone.orgY] as const;

/** SVTCA, SPVTCA and SFVTCA: the vectors along y for an even opcode, x for an odd one. */
export function setVectorsToAxis(exc: ExecContext): void {
  const { opcode, graphicsState } = exc;
  const axis = (opcode & 1) !== 0 ? X_AXIS : Y_AXIS;
  if (opcode < 4) graphicsState.projVector = graphicsState.dualVector = axis;
  if ((opcode & 2) === 0) graphicsState.freeVector = axis;
  exc.computeMoveVector();
}

/**
 * `Ins_SxVTL`: the vector from point `args[1]` of zp2 to point `args[0]` of zp1, or null for a
 * point past its zone, which leaves every vector as it was.
 */
function vectorToLine(exc: ExecContext, a: number, vector: UnitVector): UnitVector | null {
  const from = toUint16(exc.stack[a]!);
  const to = toUint16(exc.stack[a + 1]!);
  if (to >= exc.zp2.pointCount || from >= exc.zp1.pointCount) return null;
  return vectorBetween(
    vector,
    (exc.opcode & 1) !== 0,
    currentPoints(exc.zp1),
    from,
    currentPoints(exc.zp2),
    to
  );
}

/** SPVTL: the projection and dual vectors along, or across, a line of two points. */
export function setProjectionVectorToLine(exc: ExecContext, a: number): void {
  const vector = vectorToLine(exc, a, exc.graphicsState.projVector);
  if (!vector) return;
  exc.graphicsState.projVector = exc.graphicsState.dualVector = vector;
  exc.computeMoveVector();
}

/** SFVTL: the free vector along, or across, a line of two points. */
export function setFreeVectorToLine(exc: ExecContext, a: number): void {
  const vector = vectorToLine(exc, a, exc.graphicsState.freeVector);
  if (!vector) return;
  exc.graphicsState.freeVector = vector;
  exc.computeMoveVector();
}

/** SFVTPV: the free vector as the projection vector. */
export function setFreeVectorToProjectionVector(exc: ExecContext): void {
  exc.graphicsState.freeVector = exc.graphicsState.projVector;
  exc.computeMoveVector();
}

/** The vector whose 16-bit components the stack holds, x below y. */
function vectorFromStack(exc: ExecContext, a: number, vector: UnitVector): UnitVector {
  return normalised(vector, toInt16(exc.stack[a]!), toInt16(exc.stack[a + 1]!));
}

/** SPVFS: the projection and dual vectors from the stack. */
export function setProjectionVectorFromStack(exc: ExecContext, a: number): void {
  const { graphicsState } = exc;
  graphicsState.projVector = graphicsState.dualVector = vectorFromStack(exc, a, graphicsState.projVector);
  exc.computeMoveVector();
}

/** SFVFS: the free vector from the stack. */
export function setFreeVectorFromStack(exc: ExecContext, a: number): void {
  exc.graphicsState.freeVector = vectorFromStack(exc, a, exc.graphicsState.freeVector);
  exc.computeMoveVector();
}

/** GPV: the projection vector onto the stack. */
export function getProjectionVector(exc: ExecContext, a: number): void {
  exc.stack[a] = exc.graphicsState.projVector.x;
  exc.stack[a + 1] = exc.graphicsState.projVector.y;
}

/** GFV: the free vector onto the stack. */
export function getFreeVector(exc: ExecContext, a: number): void {
  exc.stack[a] = exc.graphicsState.freeVector.x;
  exc.stack[a + 1] = exc.graphicsState.freeVector.y;
}

/**
 * SDPVTL: the dual vector along the line of two original points, and the projection vector along
 * their current line. Points at one place on the original line also leave the current one unturned.
 */
export function setDualProjectionVectorToLine(exc: ExecContext, a: number): void {
  const from = toUint16(exc.stack[a]!);
  const to = toUint16(exc.stack[a + 1]!);
  if (from >= exc.zp1.pointCount || to >= exc.zp2.pointCount) return;
  const { graphicsState, zp1, zp2 } = exc;
  const isOriginalAtOnePlace = zp1.orgX[from] === zp2.orgX[to] && zp1.orgY[from] === zp2.orgY[to];
  const isPerpendicular = (exc.opcode & 1) !== 0;
  graphicsState.dualVector = vectorBetween(
    graphicsState.dualVector,
    isPerpendicular,
    originalPoints(zp1),
    from,
    originalPoints(zp2),
    to
  );
  graphicsState.projVector = vectorBetween(
    graphicsState.projVector,
    isPerpendicular && !isOriginalAtOnePlace,
    currentPoints(zp1),
    from,
    currentPoints(zp2),
    to
  );
  exc.computeMoveVector();
}
