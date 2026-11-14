/**
 * ThorVG's `Line` and `Bezier` (`tvgMath.cpp`): the length of a segment, and its split at a length
 * along it, which the dash pattern walks the outline with. Every value stays in single precision.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { f32, type Point } from './math';

/** `BEZIER_EPSILON`: how close a length must come for the search and the subdivision to stop. */
const BEZIER_EPSILON = f32(1e-2);

export interface Line {
  pt1: Point;
  pt2: Point;
}

export interface Bezier {
  start: Point;
  ctrl1: Point;
  ctrl2: Point;
  end: Point;
}

/** `_lineLength`. */
export function lineLength(pt1: Point, pt2: Point): number {
  const dx = f32(pt2.x - pt1.x);
  const dy = f32(pt2.y - pt1.y);
  return f32(Math.sqrt(f32(f32(dx * dx) + f32(dy * dy))));
}

/** `Line::split`: the line cut `at` along it. */
export function splitLine({ pt1, pt2 }: Line, at: number): { left: Line; right: Line } {
  const length = lineLength(pt1, pt2);
  const dx = f32(f32(f32(pt2.x - pt1.x) / length) * at);
  const dy = f32(f32(f32(pt2.y - pt1.y) / length) * at);
  const cut = { x: f32(pt1.x + dx), y: f32(pt1.y + dy) };
  return { left: { pt1, pt2: cut }, right: { pt1: cut, pt2 } };
}

const half = (a: number, b: number): number => f32(f32(a + b) * 0.5);

/** `Bezier::split(left, right)`: the curve cut in half. */
function splitInHalf(b: Bezier): { left: Bezier; right: Bezier } {
  const axis = (key: 'x' | 'y') => {
    const c = half(b.ctrl1[key], b.ctrl2[key]);
    const leftCtrl1 = half(b.start[key], b.ctrl1[key]);
    const rightCtrl2 = half(b.ctrl2[key], b.end[key]);
    const leftCtrl2 = half(leftCtrl1, c);
    const rightCtrl1 = half(rightCtrl2, c);
    return { leftCtrl1, rightCtrl2, leftCtrl2, rightCtrl1, middle: half(leftCtrl2, rightCtrl1) };
  };
  const x = axis('x');
  const y = axis('y');
  const middle = { x: x.middle, y: y.middle };
  return {
    left: {
      start: b.start,
      ctrl1: { x: x.leftCtrl1, y: y.leftCtrl1 },
      ctrl2: { x: x.leftCtrl2, y: y.leftCtrl2 },
      end: middle,
    },
    right: {
      start: middle,
      ctrl1: { x: x.rightCtrl1, y: y.rightCtrl1 },
      ctrl2: { x: x.rightCtrl2, y: y.rightCtrl2 },
      end: b.end,
    },
  };
}

/** `_bezLength`: the control polygon's length, halving the curve until it is within epsilon of the chord. */
export function bezierLength(b: Bezier): number {
  const length = f32(
    f32(lineLength(b.start, b.ctrl1) + lineLength(b.ctrl1, b.ctrl2)) + lineLength(b.ctrl2, b.end)
  );
  const chord = lineLength(b.start, b.end);
  if (Math.abs(f32(length - chord)) <= BEZIER_EPSILON) return length;
  const { left, right } = splitInHalf(b);
  return f32(bezierLength(left) + bezierLength(right));
}

const lerp = (a: number, b: number, t: number): number => f32(a + f32(t * f32(b - a)));

/** `Bezier::split(t, left)`: the curve before `t`, and the curve after it. */
function splitAtParameter(b: Bezier, t: number): { left: Bezier; right: Bezier } {
  const axis = (key: 'x' | 'y') => {
    const leftCtrl1 = lerp(b.start[key], b.ctrl1[key], t);
    const hold = lerp(b.ctrl1[key], b.ctrl2[key], t);
    const rightCtrl2 = lerp(b.ctrl2[key], b.end[key], t);
    const rightCtrl1 = lerp(hold, rightCtrl2, t);
    const leftCtrl2 = lerp(leftCtrl1, hold, t);
    return { leftCtrl1, leftCtrl2, rightCtrl1, rightCtrl2, cut: lerp(leftCtrl2, rightCtrl1, t) };
  };
  const x = axis('x');
  const y = axis('y');
  const cut = { x: x.cut, y: y.cut };
  return {
    left: {
      start: b.start,
      ctrl1: { x: x.leftCtrl1, y: y.leftCtrl1 },
      ctrl2: { x: x.leftCtrl2, y: y.leftCtrl2 },
      end: cut,
    },
    right: {
      start: cut,
      ctrl1: { x: x.rightCtrl1, y: y.rightCtrl1 },
      ctrl2: { x: x.rightCtrl2, y: y.rightCtrl2 },
      end: b.end,
    },
  };
}

/** `_bezAt`: the parameter where the curve's length reaches `at`, by bisection. */
function parameterAt(b: Bezier, at: number, length: number): number {
  if (at <= 0) return 0;
  if (at >= length) return 1;
  let biggest = 1;
  let smallest = 0;
  let t = 0.5;
  for (;;) {
    const leftLength = bezierLength(splitAtParameter(b, t).left);
    if (Math.abs(f32(leftLength - at)) < BEZIER_EPSILON || Math.abs(f32(smallest - biggest)) < BEZIER_EPSILON)
      return t;
    if (leftLength < at) {
      smallest = t;
      t = f32(f32(t + biggest) * 0.5);
    } else {
      biggest = t;
      t = f32(f32(smallest + t) * 0.5);
    }
  }
}

/** `Bezier::split(at, left, right)`: the curve cut `at` along its length. */
export function splitBezier(b: Bezier, at: number): { left: Bezier; right: Bezier } {
  return splitAtParameter(b, parameterAt(b, at, bezierLength(b)));
}
