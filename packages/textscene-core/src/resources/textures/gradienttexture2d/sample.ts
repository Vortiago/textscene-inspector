/**
 * Evaluates a decoded `Gradient` or `GradientTexture2D`, ported from
 * `GradientTexture2D::_get_gradient_offset_at` and `Gradient::get_color_at_offset`.
 * No THREE: CPUParticles2D samples a colour ramp per particle. Parity limitation:
 * `Gradient.interpolation_color_space` is always sRGB, so OKLab differs mid-stop.
 */

// Float arithmetic: each `f(...)` rounds as a C++ `float` operation does.
import { storedReal as f } from '../../../godot/math/real';
import { cubicInterpolatef, lerpf } from '../../../godot/math/math';
import { GradientFill, GradientInterpolationMode, GradientRepeat } from './types';
import type { Gradient, GradientTexture2D } from './types';
import type { Rgba } from '../../../godot/math/math';

/**
 * The normalised gradient offset at integer pixel `(x, y)`, mirroring Godot's
 * `_get_gradient_offset_at`. `pos` is the pixel centre in 0..1 UV space
 * (`x/(width-1)`), projected onto the fill vector per fill mode, then wrapped by
 * the repeat mode.
 */
export function gradientOffsetAt(tex: GradientTexture2D, x: number, y: number): number {
  const { fillFrom, fillTo, fill, repeat, width, height } = tex;
  if (fillFrom.x === fillTo.x && fillFrom.y === fillTo.y) return 0;

  const posX = width > 1 ? x / (width - 1) : 0;
  const posY = height > 1 ? y / (height - 1) : 0;
  const dx = fillTo.x - fillFrom.x;
  const dy = fillTo.y - fillFrom.y;

  let ofs: number;
  if (fill === GradientFill.Linear) {
    // Godot projects onto the uncapped segment: ofs is the signed projection
    // parameter along (fill_to - fill_from).
    const lenSq = dx * dx + dy * dy;
    ofs = ((posX - fillFrom.x) * dx + (posY - fillFrom.y) * dy) / lenSq;
  } else if (fill === GradientFill.Radial) {
    ofs = Math.hypot(posX - fillFrom.x, posY - fillFrom.y) / Math.hypot(dx, dy);
  } else {
    // Square: chebyshev distance ratio.
    ofs =
      Math.max(Math.abs(posX - fillFrom.x), Math.abs(posY - fillFrom.y)) /
      Math.max(Math.abs(dx), Math.abs(dy));
  }

  if (repeat === GradientRepeat.None) {
    return Math.min(1, Math.max(0, ofs));
  }
  if (repeat === GradientRepeat.Repeat) {
    ofs = ofs % 1;
    return ofs < 0 ? 1 + ofs : ofs;
  }
  // Mirror.
  ofs = Math.abs(ofs) % 2;
  return ofs > 1 ? 2 - ofs : ofs;
}

/**
 * The gradient colour at normalised `offset`, mirroring Godot's
 * `Gradient::get_color_at_offset` (`gradient.h:151-235`): binary search for the bracketing
 * stops, clamp to the endpoints, then blend by the interpolation mode in sRGB space. Every
 * step runs in float, as Godot's does, since a double lands 1/255 off on some bytes.
 */
export function sampleGradientColor(gradient: Gradient, offset: number): Rgba {
  const stops = gradient.stops;
  const n = stops.length;
  if (n === 0) return { r: 0, g: 0, b: 0, a: 1 };
  if (n === 1) return stops[0]!.color;

  const at = f(offset);
  let low = 0;
  let high = n - 1;
  let middle = 0;
  while (low <= high) {
    middle = (low + high) >> 1;
    const stopOffset = stops[middle]!.offset;
    if (stopOffset > at) {
      high = middle - 1;
    } else if (stopOffset < at) {
      low = middle + 1;
    } else {
      return stops[middle]!.color;
    }
  }
  if (stops[middle]!.offset > at) middle--;

  const first = middle;
  const second = middle + 1;
  if (second >= n) return stops[n - 1]!.color;
  if (first < 0) return stops[0]!.color;

  const c1 = stops[first]!.color;
  const c2 = stops[second]!.color;
  const weight = f(f(at - stops[first]!.offset) / f(stops[second]!.offset - stops[first]!.offset));

  if (gradient.interpolationMode === GradientInterpolationMode.Constant) {
    return c1;
  }
  if (gradient.interpolationMode === GradientInterpolationMode.Cubic) {
    let p0 = first - 1;
    let p3 = second + 1;
    if (p3 >= n) p3 = second;
    if (p0 < 0) p0 = first;
    const c0 = stops[p0]!.color;
    const c3 = stops[p3]!.color;
    return {
      r: cubicInterpolatef(c1.r, c2.r, c0.r, c3.r, weight),
      g: cubicInterpolatef(c1.g, c2.g, c0.g, c3.g, weight),
      b: cubicInterpolatef(c1.b, c2.b, c0.b, c3.b, weight),
      a: cubicInterpolatef(c1.a, c2.a, c0.a, c3.a, weight),
    };
  }
  // Linear.
  return {
    r: lerpf(c1.r, c2.r, weight),
    g: lerpf(c1.g, c2.g, weight),
    b: lerpf(c1.b, c2.b, weight),
    a: lerpf(c1.a, c2.a, weight),
  };
}
