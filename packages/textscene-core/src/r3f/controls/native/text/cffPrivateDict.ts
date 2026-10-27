/**
 * The Private DICT entries that place a font's blue zones: the alignment zones, how far a zone
 * reaches and when overshoot shows. Values follow FreeType's parse (`cffparse.c`, `cfftoken.h`):
 * zone edges and `BlueScale` in 16.16, `BlueShift` and `BlueFuzz` as whole numbers.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 1996-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { FIXED_16_16_ONE, ftDivFix } from './fontMetrics';

type Dict = ReadonlyMap<number, readonly number[]>;

export interface BlueFacts {
  /** The first zone is a bottom zone, the rest top zones. Each zone is a bottom edge then a top edge, 16.16. An even count. */
  readonly blueValues: readonly number[];
  /** Bottom zones, as pairs. */
  readonly otherBlues: readonly number[];
  readonly familyBlues: readonly number[];
  readonly familyOtherBlues: readonly number[];
  /** The scale below which overshoot is suppressed, 16.16. */
  readonly blueScale: number;
  /** In font units. */
  readonly blueShift: number;
  readonly blueFuzz: number;
  readonly languageGroup: number;
}

const OP_BLUE_VALUES = 6;
const OP_OTHER_BLUES = 7;
const OP_FAMILY_BLUES = 8;
const OP_FAMILY_OTHER_BLUES = 9;
/** A two-byte operator `12 n` is `1200 + n`. */
const OP_BLUE_SCALE = 1209;
const OP_BLUE_SHIFT = 1210;
const OP_BLUE_FUZZ = 1211;
const OP_LANGUAGE_GROUP = 1217;

/** The most numbers FreeType keeps of each array. */
const MAX_BLUE_VALUES = 14;
const MAX_OTHER_BLUES = 10;

const DEFAULT_BLUE_SHIFT = 7;
const DEFAULT_BLUE_FUZZ = 1;
/** The limit past which FreeType takes `BlueShift` and `BlueFuzz` for a corrupt value. */
const MAX_BLUE_SHIFT_OR_FUZZ = 1000;
/** `BlueScale` is parsed as a thousand times its value in 16.16. */
const BLUE_SCALE_UNIT = 1000;
const DEFAULT_BLUE_SCALE = 0.039625;

/** A DICT number in 16.16, rounded half away from zero (`cff_parse_fixed`). */
function toFixed(value: number, scale = 1): number {
  return Math.sign(value) * Math.round(Math.abs(value) * scale * FIXED_16_16_ONE);
}

/** The running sums of a delta-encoded array of at most `max` numbers, each in 16.16 (`cff_kind_delta_fixed`). */
function deltaFixed(dict: Dict, operator: number, max: number): number[] {
  let sum = 0;
  return (dict.get(operator) ?? []).slice(0, max).map((delta) => (sum += toFixed(delta)));
}

/** A whole number in `[0, 1000]`, or `fallback` for a value FreeType takes for corrupt. */
function boundedNumber(dict: Dict, operator: number, fallback: number): number {
  const value = Math.floor(dict.get(operator)?.[0] ?? fallback);
  return value < 0 || value > MAX_BLUE_SHIFT_OR_FUZZ ? fallback : value;
}

export function blueFactsOf(privateDict: Dict): BlueFacts {
  const blueValues = deltaFixed(privateDict, OP_BLUE_VALUES, MAX_BLUE_VALUES);
  const blueScaleOperand = privateDict.get(OP_BLUE_SCALE)?.[0];
  const blueScaleThousand =
    blueScaleOperand === undefined
      ? Math.trunc(DEFAULT_BLUE_SCALE * FIXED_16_16_ONE * BLUE_SCALE_UNIT)
      : toFixed(blueScaleOperand, BLUE_SCALE_UNIT);
  return {
    // FreeType drops the odd value left by a zone without a top edge.
    blueValues: blueValues.slice(0, blueValues.length & ~1),
    otherBlues: deltaFixed(privateDict, OP_OTHER_BLUES, MAX_OTHER_BLUES),
    familyBlues: deltaFixed(privateDict, OP_FAMILY_BLUES, MAX_BLUE_VALUES),
    familyOtherBlues: deltaFixed(privateDict, OP_FAMILY_OTHER_BLUES, MAX_OTHER_BLUES),
    blueScale: ftDivFix(blueScaleThousand, BLUE_SCALE_UNIT * FIXED_16_16_ONE),
    blueShift: boundedNumber(privateDict, OP_BLUE_SHIFT, DEFAULT_BLUE_SHIFT),
    blueFuzz: boundedNumber(privateDict, OP_BLUE_FUZZ, DEFAULT_BLUE_FUZZ),
    languageGroup: Math.floor(privateDict.get(OP_LANGUAGE_GROUP)?.[0] ?? 0),
  };
}
