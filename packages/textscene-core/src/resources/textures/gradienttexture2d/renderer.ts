/**
 * Rasterise a `GradientTexture2D` into a `THREE.DataTexture`.
 *
 * A faithful port of Godot's `GradientTexture2D::_get_gradient_offset_at`
 * (the fill projection) and `Gradient::get_color_at_offset` (the stop
 * interpolation), so a material's `albedo_texture = SubResource(GradientTexture2D)`
 * samples the same pixels our renderer does.
 *
 * PARITY LIMITATIONS:
 *  - `use_hdr`: we always emit RGBA8. An HDR gradient (channels > 1) would
 *    clamp; no shipped scene uses HDR gradients.
 *  - `Gradient.interpolation_color_space`: only the default sRGB space (an
 *    identity transform) is implemented; OKLab / linear-sRGB blending would
 *    differ mid-stop. No shipped scene sets a non-default space.
 */

import * as THREE from 'three';
import type { Color } from '../../../utils/colorParser';
import { GradientFill, GradientInterpolationMode, GradientRepeat } from './types';
import type { Gradient, GradientTexture2D } from './types';

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

  let ofs = 0;
  if (fill === GradientFill.Linear) {
    // Godot projects onto the UNCAPPED segment: ofs is the signed projection
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
 * `Gradient::get_color_at_offset`: binary search for the bracketing stops,
 * clamp to the endpoints, then blend by the interpolation mode. Colours are
 * blended in the default (sRGB) interpolation space — an identity transform.
 */
export function sampleGradientColor(gradient: Gradient, offset: number): Color {
  const stops = gradient.stops;
  const n = stops.length;
  if (n === 0) return { r: 0, g: 0, b: 0, a: 1 };
  if (n === 1) return stops[0]!.color;

  let low = 0;
  let high = n - 1;
  let middle = 0;
  while (low <= high) {
    middle = (low + high) >> 1;
    const stopOffset = stops[middle]!.offset;
    if (stopOffset > offset) {
      high = middle - 1;
    } else if (stopOffset < offset) {
      low = middle + 1;
    } else {
      return stops[middle]!.color;
    }
  }
  if (stops[middle]!.offset > offset) middle--;

  const first = middle;
  const second = middle + 1;
  if (second >= n) return stops[n - 1]!.color;
  if (first < 0) return stops[0]!.color;

  const c1 = stops[first]!.color;
  const c2 = stops[second]!.color;
  const weight = (offset - stops[first]!.offset) / (stops[second]!.offset - stops[first]!.offset);

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
      r: cubicInterpolate(c1.r, c2.r, c0.r, c3.r, weight),
      g: cubicInterpolate(c1.g, c2.g, c0.g, c3.g, weight),
      b: cubicInterpolate(c1.b, c2.b, c0.b, c3.b, weight),
      a: cubicInterpolate(c1.a, c2.a, c0.a, c3.a, weight),
    };
  }
  // Linear.
  return {
    r: lerp(c1.r, c2.r, weight),
    g: lerp(c1.g, c2.g, weight),
    b: lerp(c1.b, c2.b, weight),
    a: lerp(c1.a, c2.a, weight),
  };
}

/**
 * Rasterise the gradient into an RGBA8 `THREE.DataTexture` sized
 * `tex.width × tex.height`. Bytes are the sRGB-space channels rounded to 8 bit
 * (Godot's `Color::get_r8()`), so the texture is tagged `SRGBColorSpace` — the
 * renderer decodes it to linear on sample exactly as Godot decodes an albedo
 * texture. Alpha is not colour-managed and passes through linearly.
 *
 * `LinearFilter` (not DataTexture's `NearestFilter` default) matches Godot's
 * smooth sampling — a 64×64 gradient stretched over a quad must not read blocky.
 */
export function rasterizeGradientTexture2D(
  tex: GradientTexture2D,
  gradient: Gradient
): THREE.DataTexture {
  const width = Math.max(1, Math.floor(tex.width));
  const height = Math.max(1, Math.floor(tex.height));
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = gradientOffsetAt(tex, x, y);
      const color = sampleGradientColor(gradient, offset);
      const i = (x + y * width) * 4;
      data[i] = to8(color.r);
      data[i + 1] = to8(color.g);
      data[i + 2] = to8(color.b);
      data[i + 3] = to8(color.a);
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Godot's `Math::cubic_interpolate` (Catmull-Rom): blend `from`→`to` with
 *  pre/post neighbours controlling the tangents. */
function cubicInterpolate(
  from: number,
  to: number,
  pre: number,
  post: number,
  weight: number
): number {
  const w2 = weight * weight;
  const w3 = w2 * weight;
  return (
    0.5 *
    (from * 2 +
      (-pre + to) * weight +
      (2 * pre - 5 * from + 4 * to - post) * w2 +
      (-pre + 3 * from - 3 * to + post) * w3)
  );
}

/** Godot's `Color::get_r8()`: round to 8-bit, clamped to 0..255. */
function to8(channel: number): number {
  return Math.min(255, Math.max(0, Math.round(channel * 255)));
}
