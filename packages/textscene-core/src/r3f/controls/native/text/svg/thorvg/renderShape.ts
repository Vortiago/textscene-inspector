/**
 * ThorVG's `RenderShape` and `RenderStroke` (`tvgRender.h`): what a shape draws, which the
 * software engine reads. A colour is straight RGBA, each channel 0 to 255.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { f32 } from './math';
import { emptyPath, type RenderPath } from './renderPath';
import type { Fill } from './fill';
import type { FillRule, StrokeCap, StrokeJoin } from './svgNode';

export type Rgba = [r: number, g: number, b: number, a: number];

export interface RenderStroke {
  width: number;
  color: Rgba;
  fill: Fill | null;
  dashPattern: number[];
  dashOffset: number;
  cap: StrokeCap;
  join: StrokeJoin;
  miterlimit: number;
  /** True where the stroke draws under the fill. */
  strokeFirst: boolean;
}

export interface RenderShape {
  readonly path: RenderPath;
  fill: Fill | null;
  stroke: RenderStroke | null;
  color: Rgba;
  rule: FillRule;
}

export const renderShape = (): RenderShape => ({
  path: emptyPath(),
  fill: null,
  stroke: null,
  color: [0, 0, 0, 0],
  rule: 'Winding',
});

/** The stroke `new RenderStroke()` makes: no width, a clear colour, square caps and bevel joins. */
export const renderStroke = (): RenderStroke => ({
  width: 0,
  color: [0, 0, 0, 0],
  fill: null,
  dashPattern: [],
  dashOffset: 0,
  cap: 'Square',
  join: 'Bevel',
  miterlimit: 4,
  strokeFirst: false,
});

/** `MULTIPLY`: a channel scaled by an alpha, both 0 to 255, rounded up as ThorVG rounds it. */
export const multiplyAlpha = (c: number, a: number): number => (c * a + 0xff) >> 8;

/** Half a stroke, which the bounds of a stroked shape grow by on each side. */
export const halfStroke = (width: number): number => f32(width * 0.5);
