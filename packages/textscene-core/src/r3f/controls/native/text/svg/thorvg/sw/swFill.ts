/**
 * ThorVG's gradients in the software engine (`tvgSwFill.cpp`): a table of 1024 premultiplied
 * colours along the gradient, and the table colour of each pixel of a row. Every value stays in
 * single precision, as the engine computes it.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import type { Fill, FillColorStop, LinearGradient, RadialGradient } from '../fill';
import {
  approximateLength,
  f32,
  FLOAT_EPSILON,
  identityMatrix,
  inverse,
  isIdentity,
  isZero,
  multiply as multiplyMatrix,
  type Matrix,
} from '../math';
import type { FillSpread } from '../svgNode';
import { alphaBlend, argbJoin, interpolate, multiply } from './swPixel';

export const SW_COLOR_TABLE = 1024;
const RADIAL_A_THRESHOLD = f32(0.0005);
const FIXPT_BITS = 8;
const FIXPT_SIZE = 1 << FIXPT_BITS;
/** `INT32_MAX >> (FIXPT_BITS + 1)`: the largest table position the fixed-point walk takes. */
const FIXED_POINT_LIMIT = 0x7fffffff >> (FIXPT_BITS + 1);
/** The focal point outside the end circle moves this far inside it (SVG 1.1). */
const FOCAL_PRECISION = f32(0.01);

interface SwLinear {
  dx: number;
  dy: number;
  offset: number;
}

interface SwRadial {
  a11: number;
  a12: number;
  a13: number;
  a21: number;
  a22: number;
  a23: number;
  fx: number;
  fy: number;
  fr: number;
  dx: number;
  dy: number;
  dr: number;
  invA: number;
  a: number;
}

export interface SwFill {
  readonly linear: SwLinear;
  readonly radial: SwRadial;
  readonly ctable: Uint32Array;
  spread: FillSpread;
  /** A gradient of no length or radius, which draws as its last stop. */
  isSolid: boolean;
  isTranslucent: boolean;
}

export const swFill = (): SwFill => ({
  linear: { dx: 0, dy: 0, offset: 0 },
  radial: {
    a11: 0,
    a12: 0,
    a13: 0,
    a21: 0,
    a22: 0,
    a23: 0,
    fx: 0,
    fy: 0,
    fr: 0,
    dx: 0,
    dy: 0,
    dr: 0,
    invA: 0,
    a: 0,
  },
  ctable: new Uint32Array(SW_COLOR_TABLE),
  spread: 'Pad',
  isSolid: false,
  isTranslucent: false,
});

/** A float to `int32_t` as x86 converts it: out of range and NaN give `INT32_MIN`. */
function toInt32(value: number): number {
  const truncated = Math.trunc(value);
  return truncated >= -0x80000000 && truncated <= 0x7fffffff ? truncated : -0x80000000;
}

/** `_estimateAAMargin`: how many table entries a repeat blends between its last and first colour. */
function estimateAAMargin(fill: Fill): number {
  const marginScalingFactor = 800;
  if (fill.type === 'Radial') return isZero(fill.r) ? 0 : Math.trunc(f32(marginScalingFactor / fill.r));
  const len = approximateLength({ x: fill.x1, y: fill.y1 }, { x: fill.x2, y: fill.y2 });
  return isZero(len) ? 0 : Math.trunc(f32(marginScalingFactor / len));
}

function adjustAAMargin(margin: number, index: number): number {
  const threshold = Math.trunc(f32(index * f32(0.1)));
  return Math.min(margin, threshold, 40);
}

/** `_alphaUnblend`: a premultiplied word back to straight colour, each channel cut to a byte. */
function alphaUnblend(c: number): number {
  const a = c >>> 24;
  if (a === 255 || a === 0) return c;
  const invA = f32(255 / a);
  const channel = (shift: number): number => Math.trunc(f32(((c >>> shift) & 0xff) * invA)) & 0xff;
  return ((a << 24) | (channel(16) << 16) | (channel(8) << 8) | channel(0)) >>> 0;
}

/** `_applyAA`: blends a repeat's last colour into its first across the margins. */
function applyAA(fill: SwFill, begin: number, end: number): void {
  if (begin === 0 || end === 0) return;
  let i = SW_COLOR_TABLE - end;
  const rgbaEnd = alphaUnblend(fill.ctable[i]!);
  const rgbaBegin = alphaUnblend(fill.ctable[begin]!);
  const dt = f32(1 / f32(begin + end + 1));
  let t = dt;
  while (i !== begin) {
    const dist = 255 - Math.trunc(f32(255 * t));
    const color = interpolate(rgbaEnd, rgbaBegin, dist & 0xff);
    fill.ctable[i++] = alphaBlend((color | 0xff000000) >>> 0, color >>> 24);
    if (i === SW_COLOR_TABLE) i = 0;
    t = f32(t + dt);
  }
}

/** A straight colour premultiplied by its alpha, as a table entry. */
const tableEntry = (color: number, a: number): number => alphaBlend((color | 0xff000000) >>> 0, a);

/** `_updateColorTable`: the table of colours along the gradient, or false for one with no stops. */
function updateColorTable(
  fill: SwFill,
  stops: readonly FillColorStop[],
  data: Fill,
  opacity: number
): boolean {
  if (fill.isSolid) return true;
  if (stops.length === 0) return false;
  const first = stops[0]!;
  let a = multiply(first.a, opacity);
  if (a < 255) fill.isTranslucent = true;
  let rgba = argbJoin(first.r, first.g, first.b, a);
  const inc = f32(1 / SW_COLOR_TABLE);
  let pos = f32(1.5 * inc);
  let i = 0;
  const isRepeat = fill.spread === 'Repeat';
  let iAABegin = isRepeat ? estimateAAMargin(data) : 0;
  let iAAEnd = 0;
  fill.ctable[i++] = tableEntry(rgba, a);
  while (pos <= first.offset) {
    fill.ctable[i] = fill.ctable[i - 1]!;
    i++;
    pos = f32(pos + inc);
  }
  for (let j = 0; j < stops.length - 1; j++) {
    if (isRepeat && j === stops.length - 2 && iAAEnd === 0)
      iAAEnd = adjustAAMargin(iAABegin, SW_COLOR_TABLE - i);
    const curr = stops[j]!;
    const next = stops[j + 1]!;
    const delta = f32(1 / f32(next.offset - curr.offset));
    const a2 = multiply(next.a, opacity);
    if (!fill.isTranslucent && a2 < 255) fill.isTranslucent = true;
    const rgba2 = argbJoin(next.r, next.g, next.b, a2);
    while (pos < next.offset && i < SW_COLOR_TABLE) {
      const t = f32(f32(pos - curr.offset) * delta);
      const dist = Math.trunc(f32(255 * t));
      const color = interpolate(rgba, rgba2, (255 - dist) & 0xff);
      fill.ctable[i] = tableEntry(color, color >>> 24);
      i++;
      pos = f32(pos + inc);
    }
    rgba = rgba2;
    a = a2;
    if (isRepeat && j === 0) iAABegin = adjustAAMargin(iAABegin, i - 1);
  }
  rgba = tableEntry(rgba, a);
  for (; i < SW_COLOR_TABLE; i++) fill.ctable[i] = rgba;
  // A repeat blends its last colour into its first, else the last stop ends the table.
  if (isRepeat) applyAA(fill, iAABegin, iAAEnd);
  else fill.ctable[SW_COLOR_TABLE - 1] = rgba;
  return true;
}

/** The gradient's transform after the shape's: a gradient with none takes the shape's alone. */
function gradientTransform(fill: Fill, transform: Matrix): Matrix {
  const own = fill.transform ?? identityMatrix();
  return isIdentity(own) ? transform : multiplyMatrix(transform, own);
}

function prepareLinear(fill: SwFill, gradient: LinearGradient, transform: Matrix): boolean {
  const { x1, y1, x2, y2 } = gradient;
  const linear = fill.linear;
  linear.dx = f32(x2 - x1);
  linear.dy = f32(y2 - y1);
  const len = f32(f32(linear.dx * linear.dx) + f32(linear.dy * linear.dy));
  if (len < FLOAT_EPSILON) {
    if (isZero(linear.dx) && isZero(linear.dy)) fill.isSolid = true;
    return true;
  }
  linear.dx = f32(linear.dx / len);
  linear.dy = f32(linear.dy / len);
  linear.offset = f32(f32(-linear.dx * x1) - f32(linear.dy * y1));
  const inverted = inverse(gradientTransform(gradient, transform));
  if (!inverted) return false;
  linear.offset = f32(linear.offset + f32(f32(linear.dx * inverted.e13) + f32(linear.dy * inverted.e23)));
  const dx = linear.dx;
  linear.dx = f32(f32(dx * inverted.e11) + f32(linear.dy * inverted.e21));
  linear.dy = f32(f32(dx * inverted.e12) + f32(linear.dy * inverted.e22));
  return true;
}

/** `a * a - b * b - c * c`, each step rounded. */
const differenceOfSquares = (a: number, b: number, c: number): number =>
  f32(f32(f32(a * a) - f32(b * b)) - f32(c * c));

function prepareRadial(fill: SwFill, gradient: RadialGradient, transform: Matrix): boolean {
  const { cx, cy, r, fx, fy, fr } = gradient;
  if (isZero(r)) {
    fill.isSolid = true;
    return true;
  }
  const radial = fill.radial;
  radial.dr = f32(r - fr);
  radial.dx = f32(cx - fx);
  radial.dy = f32(cy - fy);
  radial.fr = fr;
  radial.fx = fx;
  radial.fy = fy;
  radial.a = differenceOfSquares(radial.dr, radial.dx, radial.dy);
  if (radial.a <= FOCAL_PRECISION) {
    const dist = f32(Math.sqrt(f32(f32(radial.dx * radial.dx) + f32(radial.dy * radial.dy))));
    const scale = f32(r * f32(1 - FOCAL_PRECISION));
    radial.fx = f32(cx + f32(f32(scale * f32(fx - cx)) / dist));
    radial.fy = f32(cy + f32(f32(scale * f32(fy - cy)) / dist));
    radial.dx = f32(cx - radial.fx);
    radial.dy = f32(cy - radial.fy);
    radial.a = differenceOfSquares(radial.dr, radial.dx, radial.dy);
  }
  if (radial.a > 0) radial.invA = f32(1 / radial.a);
  const inverted = inverse(gradientTransform(gradient, transform));
  if (!inverted) return false;
  radial.a11 = inverted.e11;
  radial.a12 = inverted.e12;
  radial.a13 = inverted.e13;
  radial.a21 = inverted.e21;
  radial.a22 = inverted.e22;
  radial.a23 = inverted.e23;
  return true;
}

/** `fillGenColorTable`: the gradient's walk through `transform` and its colour table. */
export function fillGenColorTable(fill: SwFill, data: Fill, transform: Matrix, opacity: number): boolean {
  fill.spread = data.spread;
  const isPrepared =
    data.type === 'Linear' ? prepareLinear(fill, data, transform) : prepareRadial(fill, data, transform);
  return isPrepared && updateColorTable(fill, data.stops, data, opacity);
}

/** `fillFetchSolid`: the last stop of a solid gradient, or null for one that is not solid. */
export const fillFetchSolid = (fill: SwFill, data: Fill): FillColorStop | null =>
  fill.isSolid ? (data.stops.at(-1) ?? null) : null;

function clamp(fill: SwFill, pos: number): number {
  switch (fill.spread) {
    case 'Pad':
      return pos >= SW_COLOR_TABLE ? SW_COLOR_TABLE - 1 : Math.max(pos, 0);
    case 'Repeat': {
      const at = pos % SW_COLOR_TABLE;
      return at < 0 ? SW_COLOR_TABLE + at : at;
    }
    default: {
      const limit = SW_COLOR_TABLE * 2;
      let at = pos % limit;
      if (at < 0) at += limit;
      return at >= SW_COLOR_TABLE ? limit - at - 1 : at;
    }
  }
}

const fixedPixel = (fill: SwFill, pos: number): number =>
  fill.ctable[clamp(fill, (pos + FIXPT_SIZE / 2) >> FIXPT_BITS)]!;

const pixel = (fill: SwFill, pos: number): number =>
  fill.ctable[clamp(fill, toInt32(f32(f32(pos * (SW_COLOR_TABLE - 1)) + 0.5)))]!;

/** The table colours of `len` pixels from (`x`, `y`) into `out`, through a linear gradient. */
export function linearColours(fill: SwFill, y: number, x: number, len: number, out: Uint32Array): void {
  const { dx, dy, offset } = fill.linear;
  const rx = f32(x + 0.5);
  const ry = f32(y + 0.5);
  let t = f32(f32(f32(f32(dx * rx) + f32(dy * ry)) + offset) * (SW_COLOR_TABLE - 1));
  const inc = f32(dx * (SW_COLOR_TABLE - 1));
  if (isZero(inc)) {
    out.fill(fixedPixel(fill, toInt32(f32(t * FIXPT_SIZE))), 0, len);
    return;
  }
  const v = f32(t + f32(inc * len));
  if (v < FIXED_POINT_LIMIT && v > -FIXED_POINT_LIMIT) {
    let t2 = toInt32(f32(t * FIXPT_SIZE));
    const inc2 = toInt32(f32(inc * FIXPT_SIZE));
    for (let i = 0; i < len; i++, t2 = (t2 + inc2) | 0) out[i] = fixedPixel(fill, t2);
    return;
  }
  for (let i = 0; i < len; i++, t = f32(t + inc)) out[i] = pixel(fill, f32(t / SW_COLOR_TABLE));
}

/** The table colours of `len` pixels from (`x`, `y`) into `out`, through a radial gradient. */
export function radialColours(fill: SwFill, y: number, x: number, len: number, out: Uint32Array): void {
  const radial = fill.radial;
  if (radial.a < RADIAL_A_THRESHOLD) {
    let rx = f32(
      f32(f32(f32(f32(x + 0.5) * radial.a11) + f32(f32(y + 0.5) * radial.a12)) + radial.a13) - radial.fx
    );
    let ry = f32(
      f32(f32(f32(f32(x + 0.5) * radial.a21) + f32(f32(y + 0.5) * radial.a22)) + radial.a23) - radial.fy
    );
    for (let i = 0; i < len; i++) {
      const numerator = f32(0.5 * f32(f32(f32(rx * rx) + f32(ry * ry)) - f32(radial.fr * radial.fr)));
      const denominator = f32(f32(f32(radial.dr * radial.fr) + f32(rx * radial.dx)) + f32(ry * radial.dy));
      out[i] = pixel(fill, f32(numerator / denominator));
      rx = f32(rx + radial.a11);
      ry = f32(ry + radial.a21);
    }
    return;
  }
  const c = coefficients(fill, x, y);
  for (let i = 0; i < len; i++) {
    out[i] = pixel(fill, f32(f32(Math.sqrt(c.det)) - c.b));
    c.det = f32(c.det + c.deltaDet);
    c.deltaDet = f32(c.deltaDet + c.deltaDeltaDet);
    c.b = f32(c.b + c.deltaB);
  }
}

/**
 * `_calculateCoefficients`: the quadratic of the radial gradient at the pixel, and its differences
 * along the row, so a row steps it instead of solving it at each pixel.
 */
function coefficients(
  fill: SwFill,
  x: number,
  y: number
): { b: number; deltaB: number; det: number; deltaDet: number; deltaDeltaDet: number } {
  const r = fill.radial;
  const px = f32(x + 0.5);
  const py = f32(y + 0.5);
  const rx = f32(f32(f32(f32(px * r.a11) + f32(py * r.a12)) + r.a13) - r.fx);
  const ry = f32(f32(f32(f32(px * r.a21) + f32(py * r.a22)) + r.a23) - r.fy);
  const b = f32(f32(f32(f32(r.dr * r.fr) + f32(rx * r.dx)) + f32(ry * r.dy)) * r.invA);
  const deltaB = f32(f32(f32(r.a11 * r.dx) + f32(r.a21 * r.dy)) * r.invA);
  const rr = f32(f32(rx * rx) + f32(ry * ry));
  const deltaRr = f32(f32(2 * f32(f32(rx * r.a11) + f32(ry * r.a21))) * r.invA);
  const deltaDeltaRr = f32(f32(2 * f32(f32(r.a11 * r.a11) + f32(r.a21 * r.a21))) * r.invA);
  const det = f32(f32(b * b) + f32(f32(rr - f32(r.fr * r.fr)) * r.invA));
  const deltaDet = f32(
    f32(f32(f32(f32(2 * b) * deltaB) + f32(deltaB * deltaB)) + deltaRr) + f32(deltaDeltaRr * 0.5)
  );
  const deltaDeltaDet = f32(f32(f32(2 * deltaB) * deltaB) + deltaDeltaRr);
  return { b, deltaB, det, deltaDet, deltaDeltaDet };
}

/** The table colours of a row through either gradient. */
export const gradientColours = (
  fill: SwFill,
  data: Fill,
  y: number,
  x: number,
  len: number,
  out: Uint32Array
): void =>
  data.type === 'Linear' ? linearColours(fill, y, x, len, out) : radialColours(fill, y, x, len, out);
