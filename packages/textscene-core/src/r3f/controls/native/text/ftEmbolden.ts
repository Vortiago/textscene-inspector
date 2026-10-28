/**
 * `FT_Outline_Embolden` as Godot calls it on a glyph slot (`text_server_adv.cpp:1314-1315`,
 * `:3616-3619`): each contour moves right and up by half the strength, and every corner shifts
 * along its bisector, so the join is a mitre. The port keeps FreeType's 32-bit fixed-point
 * arithmetic (`ftoutln.c` `FT_Outline_EmboldenXY`, `ftcalc.c` `FT_Vector_NormLen`).
 *
 * Portions ported from FreeType (FreeType License).
 * Copyright (c) 1996-2024 David Turner, Robert Wilhelm and Werner Lemberg.
 */

import { ftMulDiv, ftMulFix } from './fontMetrics';
import { highestBit, outlineOrientation, type ScaledOutline } from './glyphContours';
import type { Vector2 } from '../../../../godot/math/vector';

const UNIT_16_16 = 0x10000;
const FIXED_26_6_PER_PX = 64;

/** A corner turning by less than about 160 degrees shifts; a sharper one only translates (`d > -0xF000`). */
const SHARPEST_SHIFTED_TURN = -0xf000;

const NO_SHIFT: Vector2 = { x: 0, y: 0 };

const uint32 = (value: number): number => value >>> 0;

/** The longer of two lengths plus half the shorter, `FT_Vector_NormLen`'s length estimate. */
function estimatedLength(x: number, y: number): number {
  return uint32(x > y ? x + (y >>> 1) : y + (x >>> 1));
}

/**
 * `FT_Vector_NormLen`: scales `vector` to a 16.16 unit vector in place and returns its previous
 * length. A zero vector stays zero.
 */
function ftVectorNormLen(vector: Vector2): number {
  const signX = vector.x < 0 ? -1 : 1;
  const signY = vector.y < 0 ? -1 : 1;
  let x = uint32(Math.abs(vector.x));
  let y = uint32(Math.abs(vector.y));

  if (x === 0) {
    if (y > 0) vector.y = signY * UNIT_16_16;
    return y;
  }
  if (y === 0) {
    if (x > 0) vector.x = signX * UNIT_16_16;
    return x;
  }

  // Prenormalise so that the estimated length lies between 2/3 and 4/3 of one.
  let length = estimatedLength(x, y);
  let shift = 31 - highestBit(length);
  shift -= 15 + (length >= 0xaaaaaaaa >>> shift ? 1 : 0);
  if (shift > 0) {
    x = uint32(x << shift);
    y = uint32(y << shift);
    length = estimatedLength(x, y);
  } else {
    x >>>= -shift;
    y >>>= -shift;
    length >>>= -shift;
  }

  let reciprocalMinusOne = UNIT_16_16 - (length | 0);
  let u: number;
  let v: number;
  let step: number;
  do {
    u = uint32((x | 0) + (Math.imul(x | 0, reciprocalMinusOne) >> 16));
    v = uint32((y | 0) + (Math.imul(y | 0, reciprocalMinusOne) >> 16));
    step = Math.trunc(-((Math.imul(u, u) + Math.imul(v, v)) | 0) / 0x200);
    step = Math.trunc(Math.imul(step, (UNIT_16_16 + reciprocalMinusOne) >> 8) / UNIT_16_16);
    reciprocalMinusOne += step;
  } while (step > 0);

  vector.x = signX < 0 ? -u : u;
  vector.y = signY < 0 ? -v : v;

  const norm = uint32(UNIT_16_16 + Math.trunc(((Math.imul(u, x) + Math.imul(v, y)) | 0) / UNIT_16_16));
  return shift > 0 ? uint32(norm + (1 << (shift - 1))) >>> shift : uint32(norm << -shift);
}

/** The shift of one component, held to `length` where a short segment would otherwise overshoot. */
function limitedShift(
  component: number,
  strength: number,
  length: number,
  cross: number,
  turn: number
): number {
  return ftMulFix(strength, cross) <= ftMulFix(length, turn)
    ? ftMulDiv(component, strength, turn)
    : ftMulDiv(component, length, cross);
}

/** The shift of the corner between unit vectors `incoming` and `outgoing`, along their lateral bisector. */
function cornerShift(
  incoming: Vector2,
  outgoing: Vector2,
  incomingLength: number,
  outgoingLength: number,
  strength: number,
  isFillRight: boolean
): Vector2 {
  const cosine = ftMulFix(incoming.x, outgoing.x) + ftMulFix(incoming.y, outgoing.y);
  if (cosine <= SHARPEST_SHIFTED_TURN) return NO_SHIFT;

  const turn = cosine + UNIT_16_16;
  const lateralX = incoming.y + outgoing.y;
  const lateralY = incoming.x + outgoing.x;
  const cross = ftMulFix(outgoing.x, incoming.y) - ftMulFix(outgoing.y, incoming.x);
  const shortest = Math.min(incomingLength, outgoingLength);
  const signedCross = isFillRight ? -cross : cross;
  return {
    x: limitedShift(isFillRight ? -lateralX : lateralX, strength, shortest, signedCross, turn),
    y: limitedShift(isFillRight ? lateralY : -lateralY, strength, shortest, signedCross, turn),
  };
}

/**
 * Moves the points of the contour `first` to `last` by `strength` and their corner shifts. Index
 * `moved` trails `current` and advances only when points move; `anchor` closes the loop at the first
 * moved point.
 */
function emboldenContour(
  outline: ScaledOutline,
  first: number,
  last: number,
  strength: number,
  isFillRight: boolean
): void {
  let incoming = NO_SHIFT;
  let incomingLength = 0;
  let anchor = NO_SHIFT;
  let anchorLength = 0;
  let moved = last;
  let anchorIndex = -1;

  for (
    let current = first;
    current !== moved && moved !== anchorIndex;
    current = current < last ? current + 1 : first
  ) {
    let outgoing: Vector2;
    let outgoingLength: number;
    if (current !== anchorIndex) {
      outgoing = { x: outline.x[current]! - outline.x[moved]!, y: outline.y[current]! - outline.y[moved]! };
      outgoingLength = ftVectorNormLen(outgoing);
      if (outgoingLength === 0) continue;
    } else {
      outgoing = anchor;
      outgoingLength = anchorLength;
    }

    if (incomingLength === 0) {
      moved = current;
    } else {
      if (anchorIndex < 0) {
        anchorIndex = moved;
        anchor = incoming;
        anchorLength = incomingLength;
      }
      const shift = cornerShift(incoming, outgoing, incomingLength, outgoingLength, strength, isFillRight);
      for (; moved !== current; moved = moved < last ? moved + 1 : first) {
        outline.x[moved] = outline.x[moved]! + strength + shift.x;
        outline.y[moved] = outline.y[moved]! + strength + shift.y;
      }
    }
    incoming = outgoing;
    incomingLength = outgoingLength;
  }
}

/**
 * The strength Godot passes: `embolden * size.x / 16`, truncated, in 26.6 units, with `size.x` the
 * font size in 26.6 (`text_server_adv.cpp:1314`). A float product, as `embolden` is a `float`.
 */
function emboldenStrength(embolden: number, fontSizePx: number): number {
  return Math.trunc(Math.fround(Math.fround(embolden) * fontSizePx * FIXED_26_6_PER_PX) / 16);
}

/**
 * `FT_Outline_Embolden` of `outline` by `embolden` at `fontSizePx`, in place. An outline whose
 * orientation FreeType cannot tell stays as it is, as in FreeType.
 */
export function emboldenOutline(outline: ScaledOutline, embolden: number, fontSizePx: number): void {
  const strength = Math.trunc(emboldenStrength(embolden, fontSizePx) / 2);
  if (strength === 0) return;
  const orientation = outlineOrientation(outline);
  if (orientation === 'none') return;

  let first = 0;
  for (const last of outline.contourEnds) {
    emboldenContour(outline, first, last, strength, orientation === 'fillRight');
    first = last + 1;
  }
}
