/**
 * The round states of the TrueType interpreter (`ttinterp.c`, `Round_*` and `SetSuperRound`): how
 * ROUND, MDAP, MIAP, MDRP and MIRP round a 26.6 distance. A rounded distance keeps the sign of the
 * distance it rounds.
 *
 * FreeType sets every engine compensation to zero, so a distance rounds with none, and the
 * no-round state leaves a distance as it is.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { pixCeil, pixFloor, pixRound } from './ttArithmetic';

/** The `TT_Round_*` values of `GS.round_state` (`ttinterp.h`). */
export const RoundState = {
  HALF_GRID: 0,
  GRID: 1,
  DOUBLE_GRID: 2,
  DOWN_TO_GRID: 3,
  UP_TO_GRID: 4,
  OFF: 5,
  SUPER: 6,
  SUPER_45: 7,
} as const;

export type RoundStateValue = (typeof RoundState)[keyof typeof RoundState];

/** The period, phase and threshold that SROUND and S45ROUND set, in 26.6. */
export interface SuperRound {
  period: number;
  phase: number;
  threshold: number;
}

/** The grid period of SROUND, one pixel in 2.14 over 2^8. */
export const SUPER_ROUND_GRID = 0x4000;
/** The grid period of S45ROUND, one pixel over the square root of two. */
export const SUPER_ROUND_45_GRID = 0x2d41;

/**
 * Rounds the magnitude of `distance` by `roundMagnitude`, keeping its sign, and holds a result that
 * crosses zero to `floor` (`Round_To_Grid` and the others).
 */
function signed(distance: number, roundMagnitude: (magnitude: number) => number, floor: number): number {
  if (distance >= 0) return Math.max(roundMagnitude(distance), floor);
  // `0 - x`, not `-x`: C has no negative zero for a later comparison to trip on.
  return Math.min(0 - roundMagnitude(-distance), 0 - floor);
}

/** `Round_Super`: the threshold moves the step, and the period is a power of two. */
function roundSuper(distance: number, { period, phase, threshold }: SuperRound): number {
  const step = (magnitude: number) => Math.floor((magnitude + threshold - phase) / period) * period + phase;
  return signed(distance, step, phase);
}

/** `Round_Super_45`: as `roundSuper`, by a division that truncates toward zero. */
function roundSuper45(distance: number, { period, phase, threshold }: SuperRound): number {
  const step = (magnitude: number) => Math.trunc((magnitude + threshold - phase) / period) * period + phase;
  return signed(distance, step, phase);
}

/** `Round_To_Double_Grid`: to the nearest half pixel. */
function toHalfPixel(magnitude: number): number {
  return Math.floor((magnitude + 16) / 32) * 32;
}

/** `Round_To_Half_Grid`: to the middle of a pixel. */
function toPixelCentre(magnitude: number): number {
  return pixFloor(magnitude) + 32;
}

/** `exc->func_round`: `distance` rounded in `state`. */
export function roundDistance(distance: number, state: RoundStateValue, superRound: SuperRound): number {
  switch (state) {
    case RoundState.HALF_GRID:
      return signed(distance, toPixelCentre, 32);
    case RoundState.GRID:
      return signed(distance, pixRound, 0);
    case RoundState.DOUBLE_GRID:
      return signed(distance, toHalfPixel, 0);
    case RoundState.DOWN_TO_GRID:
      return signed(distance, pixFloor, 0);
    case RoundState.UP_TO_GRID:
      return signed(distance, pixCeil, 0);
    case RoundState.OFF:
      return distance;
    case RoundState.SUPER:
      return roundSuper(distance, superRound);
    case RoundState.SUPER_45:
      return roundSuper45(distance, superRound);
  }
}

/** The period of a SROUND or S45ROUND selector's bits 6 and 7, from the grid period. */
function superRoundPeriod(gridPeriod: number, selector: number): number {
  switch (selector & 0xc0) {
    case 0:
      return Math.trunc(gridPeriod / 2);
    case 0x80:
      return gridPeriod * 2;
    default:
      return gridPeriod;
  }
}

/** `SetSuperRound`: the period, phase and threshold of `selector`, worked in 2.14 and shifted to 26.6. */
export function superRoundOf(gridPeriod: number, selector: number): SuperRound {
  const period = superRoundPeriod(gridPeriod, selector);
  const phase = Math.trunc((period * ((selector & 0x30) >> 4)) / 4);
  const thresholdSelector = selector & 0x0f;
  const threshold = thresholdSelector === 0 ? period - 1 : Math.trunc(((thresholdSelector - 4) * period) / 8);
  return { period: period >> 8, phase: phase >> 8, threshold: threshold >> 8 };
}
