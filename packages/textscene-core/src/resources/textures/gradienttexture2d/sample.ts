/**
 * Evaluates a decoded `Gradient` or `GradientTexture2D`, ported from
 * `GradientTexture2D::_get_gradient_offset_at` and `Gradient::get_color_at_offset`.
 * No THREE: CPUParticles2D samples a colour ramp per particle.
 */

// Float arithmetic: each `f(...)` rounds as a C++ `float` operation does.
import { storedColor, storedReal as f } from '../../../godot/math/real';
import { cubicInterpolatef, lerpf } from '../../../godot/math/math';
import { linearSrgbToOklab, oklabToLinearSrgb } from '../../../godot/math/okLab';
import { channelToByte, linearChannelToSRGBF32, sRGBChannelToLinearF32 } from '../../../utils/colorSpace';

import type { Gradient, GradientTexture2D } from './types';
import type { Rgba } from '../../../godot/math/math';
import {
  GradientColorSpace,
  GradientTexture2DFill,
  GradientInterpolationMode,
  GradientTexture2DRepeat,
} from '../../../godot/scene/gradientTexture';

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
  if (fill === GradientTexture2DFill.LINEAR) {
    // Godot projects onto the uncapped segment: ofs is the signed projection
    // parameter along (fill_to - fill_from).
    const lenSq = dx * dx + dy * dy;
    ofs = ((posX - fillFrom.x) * dx + (posY - fillFrom.y) * dy) / lenSq;
  } else if (fill === GradientTexture2DFill.RADIAL) {
    ofs = Math.hypot(posX - fillFrom.x, posY - fillFrom.y) / Math.hypot(dx, dy);
  } else {
    // Square: chebyshev distance ratio.
    ofs =
      Math.max(Math.abs(posX - fillFrom.x), Math.abs(posY - fillFrom.y)) /
      Math.max(Math.abs(dx), Math.abs(dy));
  }

  if (repeat === GradientTexture2DRepeat.NONE) {
    return Math.min(1, Math.max(0, ofs));
  }
  if (repeat === GradientTexture2DRepeat.REPEAT) {
    ofs = ofs % 1;
    return ofs < 0 ? 1 + ofs : ofs;
  }
  // Mirror.
  ofs = Math.abs(ofs) % 2;
  return ofs > 1 ? 2 - ofs : ofs;
}

/**
 * The gradient as Godot holds it: each stop offset is a `float` and each stop colour a `Color`
 * of floats, so a scene file's double is rounded before any sample reads it.
 */
export function storedGradient(gradient: Gradient): Gradient {
  return {
    ...gradient,
    stops: gradient.stops.map((stop) => ({
      ...stop,
      offset: f(stop.offset),
      color: storedColor(stop.color),
    })),
  };
}

/**
 * The gradient colour at normalised `offset`, mirroring Godot's
 * `Gradient::get_color_at_offset` (`gradient.h:151-235`): binary search for the bracketing
 * stops, clamp to the endpoints, then blend by the interpolation mode in the interpolation colour space. Every
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

  if (gradient.interpolationMode === GradientInterpolationMode.CONSTANT) {
    return c1;
  }
  if (gradient.interpolationMode === GradientInterpolationMode.CUBIC) {
    let p0 = first - 1;
    let p3 = second + 1;
    if (p3 >= n) p3 = second;
    if (p0 < 0) p0 = first;
    const space = gradient.interpolationColorSpace;
    const [b0, b1, b2, b3] = [stops[p0]!.color, c1, c2, stops[p3]!.color].map((c) => toBlendSpace(c, space));
    return fromBlendSpace(
      {
        r: cubicInterpolatef(b1!.r, b2!.r, b0!.r, b3!.r, weight),
        g: cubicInterpolatef(b1!.g, b2!.g, b0!.g, b3!.g, weight),
        b: cubicInterpolatef(b1!.b, b2!.b, b0!.b, b3!.b, weight),
        a: cubicInterpolatef(b1!.a, b2!.a, b0!.a, b3!.a, weight),
      },
      space
    );
  }
  const space = gradient.interpolationColorSpace;
  const from = toBlendSpace(c1, space);
  const to = toBlendSpace(c2, space);
  return fromBlendSpace(
    {
      r: lerpf(from.r, to.r, weight),
      g: lerpf(from.g, to.g, weight),
      b: lerpf(from.b, to.b, weight),
      a: lerpf(from.a, to.a, weight),
    },
    space
  );
}

type ColorSpace = Gradient['interpolationColorSpace'];

/** `transform_color_space` (`gradient.h:75-97`): an OKLab colour rides in a `Color` as L, a, b and alpha. */
function toBlendSpace(color: Rgba, space: ColorSpace): Rgba {
  if (space === GradientColorSpace.SRGB) return color;
  const linear = {
    r: sRGBChannelToLinearF32(color.r),
    g: sRGBChannelToLinearF32(color.g),
    b: sRGBChannelToLinearF32(color.b),
    a: color.a,
  };
  if (space === GradientColorSpace.LINEAR_SRGB) return linear;
  const lab = linearSrgbToOklab(linear);
  return { r: lab.L, g: lab.a, b: lab.b, a: linear.a };
}

/** `inv_transform_color_space` (`gradient.h:99-119`). */
function fromBlendSpace(color: Rgba, space: ColorSpace): Rgba {
  if (space === GradientColorSpace.SRGB) return color;
  const linear =
    space === GradientColorSpace.OKLAB ? oklabToLinearSrgb({ L: color.r, a: color.g, b: color.b }) : color;
  return {
    r: linearChannelToSRGBF32(linear.r),
    g: linearChannelToSRGBF32(linear.g),
    b: linearChannelToSRGBF32(linear.b),
    a: color.a,
  };
}

/**
 * The `width` RGBA8 texels of a one-row gradient texture without `use_hdr`, as `GradientTexture1D::_update`
 * fills them (`gradient_texture.cpp:120-128`): the colour at `i / (width - 1)`, each channel a byte.
 * A `GradientTexture2D` with its default fill from (0, 0) to (1, 0) holds the same row in every row.
 */
export function gradientRowTexels(gradient: Gradient, width: number): Rgba[] {
  return Array.from({ length: width }, (_, i) => {
    const color = sampleGradientColor(gradient, f(i / (width - 1)));
    return {
      r: channelToByte(color.r) / 255,
      g: channelToByte(color.g) / 255,
      b: channelToByte(color.b) / 255,
      a: channelToByte(color.a) / 255,
    };
  });
}
