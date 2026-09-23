/**
 * Godot's `Gradient` and `GradientTexture2D`, which rasterises a 1D `Gradient`
 * across a width×height image in one of three fill modes. No THREE, so parser
 * and linter paths can import it.
 */

import type { Color } from '../../../utils/colorParser';

/** `Gradient.interpolation_mode`: how colour blends between stops. */
export enum GradientInterpolationMode {
  Linear = 0,
  Constant = 1,
  Cubic = 2,
}

/** `GradientTexture2D.fill`: how the 1D gradient projects across the image. */
export enum GradientFill {
  Linear = 0,
  Radial = 1,
  Square = 2,
}

/** `GradientTexture2D.repeat`: how offsets outside 0..1 wrap. */
export enum GradientRepeat {
  None = 0,
  Repeat = 1,
  Mirror = 2,
}

/** One `(offset, color)` stop of a Gradient, offset in 0..1. */
export interface GradientColorStop {
  offset: number;
  color: Color;
}

export interface Gradient {
  /** Stops sorted ascending by offset (Godot sorts before sampling). */
  stops: GradientColorStop[];
  interpolationMode: GradientInterpolationMode;
}

export interface GradientTexture2D {
  width: number;
  height: number;
  fill: GradientFill;
  /** Fill origin in 0..1 UV space (offset 0 of the gradient). */
  fillFrom: { x: number; y: number };
  /** Fill end in 0..1 UV space (offset 1 of the gradient). */
  fillTo: { x: number; y: number };
  repeat: GradientRepeat;
  /** `use_hdr`: an RGBAF float image instead of RGBA8. `build.ts` ignores it. */
  useHdr: boolean;
}
