/**
 * `FT_Outline_Embolden` as Godot calls it on a glyph slot (`text_server_adv.cpp:1314-1315`,
 * `:3616-3619`): each contour moves right and up by half the strength, and every corner shifts
 * along its bisector, so the join is a mitre. The port keeps FreeType's 32-bit fixed-point
 * arithmetic (`ftoutln.c` `FT_Outline_EmboldenXY`, `ftcalc.c` `FT_Vector_NormLen`).
 *
 * Portions ported from FreeType (FreeType License).
 * Copyright (c) 1996-2024 David Turner, Robert Wilhelm and Werner Lemberg.
 */

import { FIXED_16_16_ONE, ftMulDiv, ftMulFix, getFontEmboldenStrength } from './fontMetrics';
import { ftVectorNormLen } from './ftVector';
import { outlineOrientation, type ScaledOutline } from './glyphContours';
import type { Vector2 } from '../../../../godot/math/vector';

/** A corner turning by less than about 160 degrees shifts; a sharper one only translates (`d > -0xF000`). */
const SHARPEST_SHIFTED_TURN = -0xf000;

const NO_SHIFT: Vector2 = { x: 0, y: 0 };

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

  const turn = cosine + FIXED_16_16_ONE;
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
 * `FT_Outline_Embolden` of `outline` by `embolden` at `fontSizePx`, in place. An outline whose
 * orientation FreeType cannot tell stays as it is, as in FreeType.
 */
export function emboldenOutline(outline: ScaledOutline, embolden: number, fontSizePx: number): void {
  const strength = Math.trunc(getFontEmboldenStrength(embolden, fontSizePx) / 2);
  if (strength === 0) return;
  const orientation = outlineOrientation(outline);
  if (orientation === 'none') return;

  let first = 0;
  for (const last of outline.contourEnds) {
    emboldenContour(outline, first, last, strength, orientation === 'fillRight');
    first = last + 1;
  }
}
