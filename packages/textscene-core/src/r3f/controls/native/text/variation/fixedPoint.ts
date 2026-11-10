/**
 * The fixed-point conversions of `ttgxvar.c` (lines 70-81), on the `FT_Fixed` of a 64-bit `long`.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { toInt16 } from '../../../../../godot/variant/intWidth';
import { FIXED_16_16_ONE } from '../fontMetrics';

/** `FT_fdot14ToFixed`: 2.14 to 16.16. */
export const fdot14ToFixed = (value: number): number => value * 4;

/** 16.16 to 2.14, as `hb-ft.cc` hands HarfBuzz a font's normalised coordinates, and as `TT_GetVariation` gives them to a program. */
export const fixedToFdot14 = (value: number): number => value >> 2;

/** `FT_intToFixed`. */
export const intToFixed = (value: number): number => value * 0x10000;

/** `FT_fixedToFdot6`: 16.16 to 26.6, rounded half up. */
export const fixedToFdot6 = (value: number): number => Math.floor((value + 0x200) / 0x400);

/** 16.16 to a whole number, rounded half up, with no clamp to a width. */
export const fixedToWhole = (value: number): number =>
  Math.floor((value + FIXED_16_16_ONE / 2) / FIXED_16_16_ONE);

/** `FT_fixedToInt`: 16.16 to a `FT_Short`, rounded half up. */
export const fixedToInt = (value: number): number => toInt16(fixedToWhole(value));
