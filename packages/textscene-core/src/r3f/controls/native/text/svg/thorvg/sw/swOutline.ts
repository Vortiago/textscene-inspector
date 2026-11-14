/**
 * The software engine's outline (`SwOutline`, `tvgSwCommon.h`): points in 26.6 pixels, the index
 * of each contour's last point, whether each point is on the curve or a cubic control, and
 * whether each contour is closed.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import type { FillRule } from '../svgNode';
import type { SwPoint } from './swMath';

export const SW_CURVE_TYPE_POINT = 0;
export const SW_CURVE_TYPE_CUBIC = 1;

export interface SwOutline {
  readonly pts: SwPoint[];
  readonly cntrs: number[];
  readonly types: number[];
  readonly closed: boolean[];
  fillRule: FillRule;
}

export const emptyOutline = (): SwOutline => ({
  pts: [],
  cntrs: [],
  types: [],
  closed: [],
  fillRule: 'Winding',
});

/** A run of `len` pixels on row `y` from `x`, all at one coverage of 0 to 255. */
export interface SwSpan {
  x: number;
  y: number;
  len: number;
  coverage: number;
}

/** The coverage of a shape as spans, sorted by row and then by column. */
export interface SwRle {
  spans: SwSpan[];
}
