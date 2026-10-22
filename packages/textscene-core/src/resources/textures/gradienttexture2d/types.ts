/**
 * Godot's `Gradient` and `GradientTexture2D`, which rasterises a 1D `Gradient`
 * across a width×height image in one of three fill modes. No THREE, so parser
 * and linter paths can import it.
 */

import type { Rgba } from '../../../godot/math/math';
import {
  GradientInterpolationMode,
  GradientTexture2DFill,
  GradientTexture2DRepeat,
} from '../../../godot/scene/gradientTexture';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

/** One `(offset, color)` stop of a Gradient, offset in 0..1. */
export interface GradientColorStop {
  offset: number;
  color: Rgba;
}

export interface Gradient {
  /** Stops sorted ascending by offset (Godot sorts before sampling). */
  stops: GradientColorStop[];
  interpolationMode: EnumValue<typeof GradientInterpolationMode>;
}

export interface GradientTexture2D {
  width: number;
  height: number;
  fill: EnumValue<typeof GradientTexture2DFill>;
  /** Fill origin in 0..1 UV space (offset 0 of the gradient). */
  fillFrom: { x: number; y: number };
  /** Fill end in 0..1 UV space (offset 1 of the gradient). */
  fillTo: { x: number; y: number };
  repeat: EnumValue<typeof GradientTexture2DRepeat>;
  /** `use_hdr`: an RGBAF float image instead of RGBA8. `build.ts` ignores it. */
  useHdr: boolean;
}
