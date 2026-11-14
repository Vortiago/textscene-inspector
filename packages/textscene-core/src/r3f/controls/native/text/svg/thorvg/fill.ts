/**
 * ThorVG's gradient fills (`tvgFill.h`): a linear or radial gradient, its colour stops, how it
 * spreads past its ends, and the transform from its space to the shape's.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import type { Matrix } from './math';
import type { FillSpread } from './svgNode';

/** A stop's colour is straight, not premultiplied, its alpha already scaled by the paint's opacity. */
export interface FillColorStop {
  readonly offset: number;
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

interface FillCommon {
  stops: FillColorStop[];
  spread: FillSpread;
  /** Null for no transform, which `Fill::transform()` reads as the identity. */
  transform: Matrix | null;
}

export interface LinearGradient extends FillCommon {
  readonly type: 'Linear';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface RadialGradient extends FillCommon {
  readonly type: 'Radial';
  cx: number;
  cy: number;
  r: number;
  fx: number;
  fy: number;
  fr: number;
}

export type Fill = LinearGradient | RadialGradient;

export const linearGradient = (): LinearGradient => ({
  type: 'Linear',
  x1: 0,
  y1: 0,
  x2: 0,
  y2: 0,
  stops: [],
  spread: 'Pad',
  transform: null,
});

export const radialGradient = (): RadialGradient => ({
  type: 'Radial',
  cx: 0,
  cy: 0,
  r: 0,
  fx: 0,
  fy: 0,
  fr: 0,
  stops: [],
  spread: 'Pad',
  transform: null,
});

/** `RadialGradient::Impl::radial`: a negative radius leaves the gradient as it was. */
export function setRadial(
  fill: RadialGradient,
  cx: number,
  cy: number,
  r: number,
  fx: number,
  fy: number,
  fr: number
): void {
  if (r < 0 || fr < 0) return;
  Object.assign(fill, { cx, cy, r, fx, fy, fr });
}

export function duplicateFill(fill: Fill): Fill {
  return { ...fill, stops: [...fill.stops], transform: fill.transform && { ...fill.transform } };
}
