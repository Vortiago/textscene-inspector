/**
 * The software engine's fixed-point math (`tvgSwMath.cpp`, `tvgSwCommon.h`): 26.6 coordinates,
 * 16.16 angles in degrees, and the bounding box of an outline. A 64-bit `SwCoord` holds values a
 * JavaScript number holds exactly, so shifts become floored divisions.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { atan2, f32, MATH_PI, type Matrix, type Point } from '../math';

/** `SW_ANGLE_PI` and its multiples: degrees in 16.16. */
export const SW_ANGLE_PI = 180 * 65536;
const SW_ANGLE_2PI = SW_ANGLE_PI * 2;
export const SW_ANGLE_PI2 = SW_ANGLE_PI / 2;

export interface SwPoint {
  x: number;
  y: number;
}

export interface SwBBox {
  min: SwPoint;
  max: SwPoint;
}

export const emptyBBox = (): SwBBox => ({ min: { x: 0, y: 0 }, max: { x: 0, y: 0 } });

export function resetBBox(box: SwBBox): void {
  box.min.x = box.min.y = box.max.x = box.max.y = 0;
}

export const copyBBox = (box: SwBBox): SwBBox => ({ min: { ...box.min }, max: { ...box.max } });

/** `a >> bits` on a signed 64-bit integer: a division that rounds toward minus infinity. */
export const shiftRight = (a: number, bits: number): number => Math.floor(a / 2 ** bits);

/** `TO_SWCOORD`: a float in pixels to 26.6, cut toward zero. */
export const toSwCoord = (value: number): number => Math.trunc(f32(value * 64));

/** `TO_FLOAT`: 26.6 to a float in pixels. */
const toFloat = (value: number): number => f32(f32(value) / 64);

/** `nearbyint` in the default rounding mode: the nearest integer, a tie to even. */
export function nearbyint(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (fraction > 0.5) return floor + 1;
  if (fraction < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** C's `round`: the nearest integer, a tie away from zero. */
const roundAway = (value: number): number => Math.sign(value) * Math.round(Math.abs(value));

export const isSmall = (pt: SwPoint): boolean => Math.abs(pt.x) < 2 && Math.abs(pt.y) < 2;

export const isZeroPoint = (pt: SwPoint): boolean => pt.x === 0 && pt.y === 0;

const toPoint = (pt: SwPoint): Point => ({ x: toFloat(pt.x), y: toFloat(pt.y) });

const cosf = (radian: number): number => f32(Math.cos(radian));
const sinf = (radian: number): number => f32(Math.sin(radian));

function toRadian(angle: number): number {
  return f32(f32(f32(angle) / 65536) * f32(MATH_PI / f32(180)));
}

/** The sign of a product of several values, and their magnitudes. */
function unsigned(values: number[]): { sign: number; magnitudes: number[] } {
  let sign = 1;
  const magnitudes = values.map((value) => {
    if (value < 0) sign = -sign;
    return Math.abs(value);
  });
  return { sign, magnitudes };
}

/** `mathMultiply`: a 16.16 product, rounded half up on its magnitude. */
export function mathMultiply(a: number, b: number): number {
  const {
    sign,
    magnitudes: [x, y],
  } = unsigned([a, b]);
  const c = shiftRight(x! * y! + 0x8000, 16);
  return sign > 0 ? c : -c;
}

/** `mathDivide`: a 16.16 quotient, or `0x7FFFFFFF` over zero. */
export function mathDivide(a: number, b: number): number {
  const {
    sign,
    magnitudes: [x, y],
  } = unsigned([a, b]);
  const q = y! > 0 ? Math.trunc((x! * 65536 + shiftRight(y!, 1)) / y!) : 0x7fffffff;
  return sign < 0 ? -q : q;
}

/** `mathMulDiv`: `a * b / c`, rounded half up on its magnitude. */
export function mathMulDiv(a: number, b: number, c: number): number {
  const {
    sign,
    magnitudes: [x, y, z],
  } = unsigned([a, b, c]);
  const d = z! > 0 ? Math.trunc((x! * y! + shiftRight(z!, 1)) / z!) : 0x7fffffff;
  return sign > 0 ? d : -d;
}

export function mathRotate(pt: SwPoint, angle: number): void {
  if (angle === 0 || isZeroPoint(pt)) return;
  const v = toPoint(pt);
  const radian = toRadian(angle);
  const cosv = cosf(radian);
  const sinv = sinf(radian);
  pt.x = nearbyint(f32(f32(f32(v.x * cosv) - f32(v.y * sinv)) * 64));
  pt.y = nearbyint(f32(f32(f32(v.x * sinv) + f32(v.y * cosv)) * 64));
}

export function mathTan(angle: number): number {
  if (angle === 0) return 0;
  return Math.trunc(f32(f32(Math.tan(toRadian(angle))) * 65536));
}

export function mathAtan(pt: SwPoint): number {
  if (isZeroPoint(pt)) return 0;
  const degrees = f32(atan2(toFloat(pt.y), toFloat(pt.x)) * f32(f32(180) / MATH_PI));
  return Math.trunc(f32(degrees * 65536));
}

export function mathCos(angle: number): number {
  return Math.trunc(f32(cosf(toRadian(angle)) * 65536));
}

export function mathSin(angle: number): number {
  if (angle === 0) return 0;
  return mathCos(SW_ANGLE_PI2 - angle);
}

/** `mathLength`: alpha max plus beta min, in 26.6. */
export function mathLength(pt: SwPoint): number {
  if (isZeroPoint(pt)) return 0;
  if (pt.x === 0) return Math.abs(pt.y);
  if (pt.y === 0) return Math.abs(pt.x);
  const x = Math.abs(toFloat(pt.x));
  const y = Math.abs(toFloat(pt.y));
  return Math.trunc(x > y ? f32(x + f32(y * 0.375)) : f32(y + f32(x * 0.375)));
}

/** `mathDiff`: the signed angle from `angle1` to `angle2`, in (-PI, PI]. */
export function mathDiff(angle1: number, angle2: number): number {
  let delta = (angle2 - angle1) % SW_ANGLE_2PI;
  if (delta < 0) delta += SW_ANGLE_2PI;
  if (delta > SW_ANGLE_PI) delta -= SW_ANGLE_2PI;
  return delta;
}

export const mathMean = (angle1: number, angle2: number): number =>
  angle1 + Math.trunc(mathDiff(angle1, angle2) / 2);

/** The angles in, through and out of a cubic, and -1 for one too small to draw, 0 for a flat one, else 1. */
export function mathCubicAngle(
  base: SwPoint[],
  at: number
): { result: number; angleIn: number; angleMid: number; angleOut: number } {
  const d1 = { x: base[at + 2]!.x - base[at + 3]!.x, y: base[at + 2]!.y - base[at + 3]!.y };
  const d2 = { x: base[at + 1]!.x - base[at + 2]!.x, y: base[at + 1]!.y - base[at + 2]!.y };
  const d3 = { x: base[at]!.x - base[at + 1]!.x, y: base[at]!.y - base[at + 1]!.y };
  let angleIn: number;
  let angleMid: number;
  let angleOut: number;
  if (isSmall(d1)) {
    if (isSmall(d2)) {
      if (isSmall(d3)) return { result: -1, angleIn: 0, angleMid: 0, angleOut: 0 };
      angleIn = angleMid = angleOut = mathAtan(d3);
    } else if (isSmall(d3)) {
      angleIn = angleMid = angleOut = mathAtan(d2);
    } else {
      angleIn = angleMid = mathAtan(d2);
      angleOut = mathAtan(d3);
    }
  } else if (isSmall(d2)) {
    if (isSmall(d3)) {
      angleIn = angleMid = angleOut = mathAtan(d1);
    } else {
      angleIn = mathAtan(d1);
      angleOut = mathAtan(d3);
      angleMid = mathMean(angleIn, angleOut);
    }
  } else if (isSmall(d3)) {
    angleIn = mathAtan(d1);
    angleMid = angleOut = mathAtan(d2);
  } else {
    angleIn = mathAtan(d1);
    angleMid = mathAtan(d2);
    angleOut = mathAtan(d3);
  }
  const theta1 = Math.abs(mathDiff(angleIn, angleMid));
  const theta2 = Math.abs(mathDiff(angleMid, angleOut));
  const isFlat = theta1 < SW_ANGLE_PI / 8 && theta2 < SW_ANGLE_PI / 8;
  return { result: isFlat ? 0 : 1, angleIn, angleMid, angleOut };
}

/** `mathSplitCubic`: the cubic at `base[at..at+3]` split in two at its middle, into `base[at..at+6]`. */
export function mathSplitCubic(base: SwPoint[], at: number): void {
  for (const axis of ['x', 'y'] as const) {
    base[at + 6]![axis] = base[at + 3]![axis];
    let c = base[at + 1]![axis];
    const d = base[at + 2]![axis];
    const a1 = shiftRight(base[at]![axis] + c, 1);
    const b1 = shiftRight(base[at + 3]![axis] + d, 1);
    base[at + 1]![axis] = a1;
    base[at + 5]![axis] = b1;
    c = shiftRight(c + d, 1);
    const a2 = shiftRight(a1 + c, 1);
    const b2 = shiftRight(b1 + c, 1);
    base[at + 2]![axis] = a2;
    base[at + 4]![axis] = b2;
    base[at + 3]![axis] = shiftRight(a2 + b2, 1);
  }
}

/** `mathTransform`: a point through the matrix, in 26.6. */
export function mathTransform(to: Point, m: Matrix): SwPoint {
  const tx = f32(f32(f32(to.x * m.e11) + f32(to.y * m.e12)) + m.e13);
  const ty = f32(f32(f32(to.x * m.e21) + f32(to.y * m.e22)) + m.e23);
  return { x: toSwCoord(tx), y: toSwCoord(ty) };
}

/** `mathClipBBox`: `clippee` cut to `clipper`, and whether anything is left. */
function mathClipBBox(clipper: SwBBox, clippee: SwBBox): boolean {
  clippee.max.x = Math.min(clippee.max.x, clipper.max.x);
  clippee.max.y = Math.min(clippee.max.y, clipper.max.y);
  clippee.min.x = Math.max(clippee.min.x, clipper.min.x);
  clippee.min.y = Math.max(clippee.min.y, clipper.min.y);
  if (clippee.max.x - clippee.min.x < 1 && clippee.max.y - clippee.min.y < 1) return false;
  return !(
    clippee.min.x >= clipper.max.x ||
    clippee.min.y >= clipper.max.y ||
    clippee.max.x <= clipper.min.x ||
    clippee.max.y <= clipper.min.y
  );
}

/** The outline's points as whole pixels into `renderRegion`, cut to `clipRegion`. */
export function mathUpdateOutlineBBox(
  pts: readonly SwPoint[],
  hasContours: boolean,
  clipRegion: SwBBox,
  renderRegion: SwBBox,
  isFastTrack: boolean
): boolean {
  if (pts.length === 0 || !hasContours) {
    resetBBox(renderRegion);
    return false;
  }
  let xMin = pts[0]!.x;
  let xMax = xMin;
  let yMin = pts[0]!.y;
  let yMax = yMin;
  for (const pt of pts) {
    xMin = Math.min(xMin, pt.x);
    xMax = Math.max(xMax, pt.x);
    yMin = Math.min(yMin, pt.y);
    yMax = Math.max(yMax, pt.y);
  }
  if (isFastTrack) {
    renderRegion.min.x = roundAway(f32(xMin / 64));
    renderRegion.max.x = roundAway(f32(xMax / 64));
    renderRegion.min.y = roundAway(f32(yMin / 64));
    renderRegion.max.y = roundAway(f32(yMax / 64));
  } else {
    renderRegion.min.x = shiftRight(xMin, 6);
    renderRegion.max.x = shiftRight(xMax + 63, 6);
    renderRegion.min.y = shiftRight(yMin, 6);
    renderRegion.max.y = shiftRight(yMax + 63, 6);
  }
  return mathClipBBox(clipRegion, renderRegion);
}
