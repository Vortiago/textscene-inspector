/**
 * Typed representation of Godot's `Gradient` and `GradientTexture2D` resources.
 *
 * A `GradientTexture2D` rasterises a 1D `Gradient` across a width×height image
 * using one of three fill modes (linear / radial / square). The coin sprite in
 * the 3D platformer uses one as its additive-glow albedo: a radial white→
 * transparent falloff that produces the halo around each coin.
 *
 * Pure data — no THREE. The rasteriser (`build.ts`) is the only THREE consumer,
 * so these types stay importable by pure `.ts` (parser/linter) paths.
 */

import type { Color } from '../../../utils/colorParser';

/** `Gradient.interpolation_mode` — how colour is blended between stops. */
export enum GradientInterpolationMode {
  Linear = 0,
  Constant = 1,
  Cubic = 2,
}

/** `GradientTexture2D.fill` — how the 1D gradient is projected across the image. */
export enum GradientFill {
  Linear = 0,
  Radial = 1,
  Square = 2,
}

/** `GradientTexture2D.repeat` — how offsets outside 0..1 wrap. */
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
  /** `use_hdr` — an RGBAF float image instead of RGBA8. We always rasterise
   *  RGBA8 (see build.ts); this flag is parsed for completeness. */
  useHdr: boolean;
}
