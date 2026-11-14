/**
 * ThorVG's stroker (`tvgSwStroke.cpp`), FreeType's `ftstroke.c` in 26.6: the two borders of an
 * outline's stroke, with its joins and caps, exported as one outline the rasterizer fills.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { f32, type Matrix } from '../math';
import { halfStroke, type RenderShape } from '../renderShape';
import type { StrokeCap, StrokeJoin } from '../svgNode';
import {
  isSmall,
  isZeroPoint,
  mathAtan,
  mathCos,
  mathCubicAngle,
  mathDiff,
  mathDivide,
  mathLength,
  mathMean,
  mathMulDiv,
  mathMultiply,
  mathRotate,
  mathSin,
  mathSplitCubic,
  mathTan,
  shiftRight,
  SW_ANGLE_PI,
  SW_ANGLE_PI2,
  toSwCoord,
  type SwPoint,
} from './swMath';
import { emptyOutline, SW_CURVE_TYPE_CUBIC, SW_CURVE_TYPE_POINT, type SwOutline } from './swOutline';

const TAG_POINT = 1;
const TAG_CUBIC = 2;
const TAG_BEGIN = 4;
const TAG_END = 8;

/** The largest step of an arc that one cubic draws. */
const ARC_CUBIC_ANGLE = SW_ANGLE_PI / 2;
/** `bezStack + 32`: the depth past which a cubic is no longer split. */
const BEZIER_STACK_LIMIT = 32;
const BEZIER_STACK_SIZE = 37;

/** One side of a stroke: its points, a tag for each, and the start of the open sub-path, or -1. */
interface StrokeBorder {
  pts: SwPoint[];
  tags: number[];
  start: number;
  movable: boolean;
}

export interface SwStroke {
  angleIn: number;
  angleOut: number;
  center: SwPoint;
  lineLength: number;
  subPathAngle: number;
  ptStartSubPath: SwPoint;
  subPathLineLength: number;
  width: number;
  miterlimit: number;
  cap: StrokeCap;
  join: StrokeJoin;
  joinSaved: StrokeJoin;
  readonly borders: [StrokeBorder, StrokeBorder];
  sx: number;
  sy: number;
  firstPt: boolean;
  closedSubPath: boolean;
  handleWideStrokes: boolean;
}

const emptyBorder = (): StrokeBorder => ({ pts: [], tags: [], start: -1, movable: false });

const add = (a: SwPoint, b: SwPoint): SwPoint => ({ x: a.x + b.x, y: a.y + b.y });
const subtract = (a: SwPoint, b: SwPoint): SwPoint => ({ x: a.x - b.x, y: a.y - b.y });

const sideToRotate = (side: number): number => SW_ANGLE_PI2 - side * SW_ANGLE_PI;

/** `SCALE`: a point through the stroke's scale, cut toward zero. */
function scale(stroke: SwStroke, pt: SwPoint): void {
  pt.x = Math.trunc(f32(f32(pt.x) * stroke.sx));
  pt.y = Math.trunc(f32(f32(pt.y) * stroke.sy));
}

/** A vector of `length` at `angle`, through the stroke's scale. */
function scaledVector(stroke: SwStroke, length: number, angle: number): SwPoint {
  const pt = { x: Math.trunc(length), y: 0 };
  mathRotate(pt, angle);
  scale(stroke, pt);
  return pt;
}

function borderClose(border: StrokeBorder, isReversed: boolean): void {
  const { start } = border;
  let count = border.pts.length;
  if (count <= start + 1) {
    border.pts.length = border.tags.length = start;
  } else {
    // The last point holds the adjusted start of the sub-path.
    count--;
    border.pts[start] = border.pts[count]!;
    border.pts.length = border.tags.length = count;
    if (isReversed) {
      reverseRange(border.pts, start + 1, count - 1);
      reverseRange(border.tags, start + 1, count - 1);
    }
    border.tags[start]! |= TAG_BEGIN;
    border.tags[count - 1]! |= TAG_END;
  }
  border.start = -1;
  border.movable = false;
}

function reverseRange<T>(items: T[], first: number, last: number): void {
  for (let i = first, j = last; i < j; i++, j--) [items[i], items[j]] = [items[j]!, items[i]!];
}

function borderCubicTo(border: StrokeBorder, ctrl1: SwPoint, ctrl2: SwPoint, to: SwPoint): void {
  border.pts.push({ ...ctrl1 }, { ...ctrl2 }, { ...to });
  border.tags.push(TAG_CUBIC, TAG_CUBIC, TAG_POINT);
  border.movable = false;
}

function borderArcTo(
  border: StrokeBorder,
  center: SwPoint,
  radius: number,
  angleStart: number,
  angleDiff: number,
  stroke: SwStroke
): void {
  let a = add(scaledVector(stroke, radius, angleStart), center);
  let total = angleDiff;
  let angle = angleStart;
  const rotate = angleDiff >= 0 ? SW_ANGLE_PI2 : -SW_ANGLE_PI2;
  while (total !== 0) {
    const step = Math.max(-ARC_CUBIC_ANGLE, Math.min(ARC_CUBIC_ANGLE, total));
    const next = angle + step;
    const theta = shiftRight(Math.abs(step), 1);
    const b = add(scaledVector(stroke, radius, next), center);
    const length = mathMulDiv(radius, mathSin(theta) * 4, (0x10000 + mathCos(theta)) * 3);
    const a2 = add(scaledVector(stroke, length, angle + rotate), a);
    const b2 = add(scaledVector(stroke, length, next - rotate), b);
    borderCubicTo(border, a2, b2, b);
    a = b;
    total -= step;
    angle = next;
  }
}

function borderLineTo(border: StrokeBorder, to: SwPoint, isMovable: boolean): void {
  const count = border.pts.length;
  if (border.movable) {
    border.pts[count - 1] = { ...to };
  } else {
    // A zero-length line is not added.
    if (count > 0 && isSmall(subtract(border.pts[count - 1]!, to))) return;
    border.pts.push({ ...to });
    border.tags.push(TAG_POINT);
  }
  border.movable = isMovable;
}

function borderMoveTo(border: StrokeBorder, to: SwPoint): void {
  if (border.start >= 0) borderClose(border, false);
  border.start = border.pts.length;
  border.movable = false;
  borderLineTo(border, to, false);
}

function arcTo(stroke: SwStroke, side: number): void {
  const border = stroke.borders[side]!;
  const rotate = sideToRotate(side);
  let total = mathDiff(stroke.angleIn, stroke.angleOut);
  if (total === SW_ANGLE_PI) total = -rotate * 2;
  borderArcTo(border, stroke.center, stroke.width, stroke.angleIn + rotate, total, stroke);
  border.movable = false;
}

/** The outer side of a corner: a round, mitred or bevelled join. */
function outside(stroke: SwStroke, side: number, lineLength: number): void {
  const border = stroke.borders[side]!;
  if (stroke.join === 'Round') {
    arcTo(stroke, side);
    return;
  }
  const rotate = sideToRotate(side);
  let isBevel = stroke.join === 'Bevel';
  let phi = 0;
  let thcos = 0;
  if (!isBevel) {
    let theta = mathDiff(stroke.angleIn, stroke.angleOut);
    if (theta === SW_ANGLE_PI) {
      theta = rotate;
      phi = stroke.angleIn;
    } else {
      theta = Math.trunc(theta / 2);
      phi = stroke.angleIn + theta + rotate;
    }
    thcos = mathCos(theta);
    // The mitre limit is exceeded.
    if (mathMultiply(stroke.miterlimit, thcos) < 0x10000) isBevel = true;
  }
  if (isBevel) {
    const delta = add(scaledVector(stroke, stroke.width, stroke.angleOut + rotate), stroke.center);
    border.movable = false;
    borderLineTo(border, delta, false);
    return;
  }
  borderLineTo(border, add(scaledVector(stroke, mathDivide(stroke.width, thcos), phi), stroke.center), false);
  // A curve has no line length, and its end point is added here.
  if (lineLength === 0)
    borderLineTo(
      border,
      add(scaledVector(stroke, stroke.width, stroke.angleOut + rotate), stroke.center),
      false
    );
}

/** The inner side of a corner: the two borders meet where both lines are long enough. */
function inside(stroke: SwStroke, side: number, lineLength: number): void {
  const border = stroke.borders[side]!;
  const theta = Math.trunc(mathDiff(stroke.angleIn, stroke.angleOut) / 2);
  let intersects = false;
  if (border.movable && lineLength > 0) {
    const minLength = Math.abs(mathMultiply(stroke.width, mathTan(theta)));
    if (stroke.lineLength >= minLength && lineLength >= minLength) intersects = true;
  }
  const rotate = sideToRotate(side);
  let delta: SwPoint;
  if (!intersects) {
    delta = add(scaledVector(stroke, stroke.width, stroke.angleOut + rotate), stroke.center);
    border.movable = false;
  } else {
    const phi = stroke.angleIn + theta;
    delta = add(scaledVector(stroke, mathDivide(stroke.width, mathCos(theta)), phi + rotate), stroke.center);
  }
  borderLineTo(border, delta, false);
}

function processCorner(stroke: SwStroke, lineLength: number): void {
  const turn = mathDiff(stroke.angleIn, stroke.angleOut);
  if (turn === 0) return;
  // A turn to the right has its inside on side 0.
  const insideSide = turn < 0 ? 1 : 0;
  inside(stroke, insideSide, lineLength);
  outside(stroke, 1 - insideSide, lineLength);
}

function firstSubPath(stroke: SwStroke, startAngle: number, lineLength: number): void {
  const delta = scaledVector(stroke, stroke.width, startAngle + SW_ANGLE_PI2);
  borderMoveTo(stroke.borders[0], add(stroke.center, delta));
  borderMoveTo(stroke.borders[1], subtract(stroke.center, delta));
  stroke.subPathAngle = startAngle;
  stroke.firstPt = false;
  stroke.subPathLineLength = lineLength;
}

function lineTo(stroke: SwStroke, to: SwPoint): void {
  let delta = subtract(to, stroke.center);
  if (isZeroPoint(delta)) {
    // A round or square cap draws a dot for a line of no length.
    if (stroke.firstPt && stroke.cap !== 'Butt') firstSubPath(stroke, 0, 0);
    return;
  }
  // The line length is measured without the scale, as the stroke width is not scaled.
  delta.x = Math.trunc(f32(f32(delta.x) / stroke.sx));
  delta.y = Math.trunc(f32(f32(delta.y) / stroke.sy));
  const lineLength = mathLength(delta);
  const angle = mathAtan(delta);
  delta = scaledVector(stroke, stroke.width, angle + SW_ANGLE_PI2);
  if (stroke.firstPt) {
    firstSubPath(stroke, angle, lineLength);
  } else {
    stroke.angleOut = angle;
    processCorner(stroke, lineLength);
  }
  // The ends of a line's borders are movable.
  borderLineTo(stroke.borders[0], add(to, delta), true);
  borderLineTo(stroke.borders[1], subtract(to, delta), true);
  stroke.angleIn = angle;
  stroke.center = { ...to };
  stroke.lineLength = lineLength;
}

function cubicTo(stroke: SwStroke, ctrl1: SwPoint, ctrl2: SwPoint, to: SwPoint): void {
  const stack: SwPoint[] = Array.from({ length: BEZIER_STACK_SIZE }, () => ({ x: 0, y: 0 }));
  let arc = 0;
  let isFirstArc = true;
  stack[0] = { ...to };
  stack[1] = { ...ctrl2 };
  stack[2] = { ...ctrl1 };
  stack[3] = { ...stroke.center };
  while (arc >= 0) {
    const angles = mathCubicAngle(stack, arc);
    if (angles.result > 0 && arc < BEZIER_STACK_LIMIT) {
      if (stroke.firstPt) stroke.angleIn = angles.angleIn;
      mathSplitCubic(stack, arc);
      arc += 3;
      continue;
    }
    if (angles.result < 0 && arc === 0) {
      stroke.center = { ...to };
      if (stroke.firstPt && stroke.cap !== 'Butt') firstSubPath(stroke, 0, 0);
      return;
    }
    const { angleIn, angleMid, angleOut } = angles;
    if (isFirstArc) {
      isFirstArc = false;
      if (stroke.firstPt) {
        firstSubPath(stroke, angleIn, 0);
      } else {
        stroke.angleOut = angleIn;
        processCorner(stroke, 0);
      }
    } else if (Math.abs(mathDiff(stroke.angleIn, angleIn)) > SW_ANGLE_PI / 8 / 4) {
      // Too great a turn from one arc to the next takes a round corner.
      stroke.center = { ...stack[arc + 3]! };
      stroke.angleOut = angleIn;
      stroke.join = 'Round';
      processCorner(stroke, 0);
      stroke.join = stroke.joinSaved;
    }
    addArc(stroke, stack, arc, angleIn, angleMid, angleOut);
    arc -= 3;
    stroke.angleIn = angleOut;
  }
  stroke.center = { ...to };
}

/** The borders of one arc small enough to add as it is. */
function addArc(
  stroke: SwStroke,
  stack: readonly SwPoint[],
  arc: number,
  angleIn: number,
  angleMid: number,
  angleOut: number
): void {
  const theta1 = Math.trunc(mathDiff(angleIn, angleMid) / 2);
  const theta2 = Math.trunc(mathDiff(angleMid, angleOut) / 2);
  const phi1 = mathMean(angleIn, angleMid);
  const phi2 = mathMean(angleMid, angleOut);
  const length1 = mathDivide(stroke.width, mathCos(theta1));
  const length2 = mathDivide(stroke.width, mathCos(theta2));
  const alpha0 = stroke.handleWideStrokes ? mathAtan(subtract(stack[arc]!, stack[arc + 3]!)) : 0;
  for (let side = 0; side < 2; side++) {
    const border = stroke.borders[side]!;
    const rotate = sideToRotate(side);
    const ctrl1 = add(scaledVector(stroke, length1, phi1 + rotate), stack[arc + 2]!);
    const ctrl2 = add(scaledVector(stroke, length2, phi2 + rotate), stack[arc + 1]!);
    const end = add(scaledVector(stroke, stroke.width, angleOut + rotate), stack[arc]!);
    if (stroke.handleWideStrokes && addWideArc(border, stack, arc, alpha0, ctrl1, ctrl2, end)) continue;
    borderCubicTo(border, ctrl1, ctrl2, end);
  }
}

/**
 * A border whose radius is greater than the arc's radius of curvature runs against the arc: it
 * goes round the negative sector backwards. False where the border runs with the arc.
 */
function addWideArc(
  border: StrokeBorder,
  stack: readonly SwPoint[],
  arc: number,
  alpha0: number,
  ctrl1: SwPoint,
  ctrl2: SwPoint,
  end: SwPoint
): boolean {
  const start = border.pts[border.pts.length - 1]!;
  const alpha1 = mathAtan(subtract(end, start));
  if (Math.abs(mathDiff(alpha0, alpha1)) <= SW_ANGLE_PI / 2) return false;
  // The sine rule finds the intersection point.
  const beta = mathAtan(subtract(stack[arc + 3]!, start));
  const gamma = mathAtan(subtract(stack[arc]!, end));
  const blen = mathLength(subtract(end, start));
  const sinA = Math.abs(mathSin(alpha1 - gamma));
  const sinB = Math.abs(mathSin(beta - gamma));
  const delta = { x: Math.trunc(mathMulDiv(blen, sinA, sinB)), y: 0 };
  mathRotate(delta, beta);
  border.movable = false;
  borderLineTo(border, add(delta, start), false);
  borderLineTo(border, end, false);
  borderCubicTo(border, ctrl2, ctrl1, start);
  borderLineTo(border, end, false);
  return true;
}

function addCap(stroke: SwStroke, angle: number, side: number): void {
  const border = stroke.borders[side]!;
  const rotate = sideToRotate(side);
  switch (stroke.cap) {
    case 'Square': {
      const along = scaledVector(stroke, stroke.width, angle);
      borderLineTo(
        border,
        add(add(along, stroke.center), scaledVector(stroke, stroke.width, angle + rotate)),
        false
      );
      const along2 = scaledVector(stroke, stroke.width, angle);
      borderLineTo(
        border,
        add(add(along2, scaledVector(stroke, stroke.width, angle - rotate)), stroke.center),
        false
      );
      return;
    }
    case 'Round':
      stroke.angleIn = angle;
      stroke.angleOut = angle + SW_ANGLE_PI;
      arcTo(stroke, side);
      return;
    default:
      borderLineTo(border, add(scaledVector(stroke, stroke.width, angle + rotate), stroke.center), false);
      borderLineTo(border, add(scaledVector(stroke, stroke.width, angle - rotate), stroke.center), false);
  }
}

/** Appends the left border's open sub-path, reversed, to the right border. */
function addReverseLeft(stroke: SwStroke, isOpened: boolean): void {
  const [right, left] = stroke.borders;
  if (left.pts.length - left.start <= 0) return;
  for (let i = left.pts.length - 1; i >= left.start; i--) {
    let tag = left.tags[i]!;
    if (isOpened) {
      tag &= ~(TAG_BEGIN | TAG_END);
    } else {
      const ends = tag & (TAG_BEGIN | TAG_END);
      if (ends === TAG_BEGIN || ends === TAG_END) tag ^= TAG_BEGIN | TAG_END;
    }
    right.pts.push(left.pts[i]!);
    right.tags.push(tag);
  }
  left.pts.length = left.tags.length = left.start;
  right.movable = false;
  left.movable = false;
}

function beginSubPath(stroke: SwStroke, to: SwPoint, isClosed: boolean): void {
  stroke.firstPt = true;
  stroke.center = { ...to };
  stroke.closedSubPath = isClosed;
  // Only a bevel join or a butt cap leaves the negative sector of a wide stroke uncovered.
  stroke.handleWideStrokes = stroke.join !== 'Round' || (!isClosed && stroke.cap === 'Butt');
  stroke.ptStartSubPath = { ...to };
  stroke.angleIn = 0;
}

function endSubPath(stroke: SwStroke): void {
  if (stroke.closedSubPath) {
    const { center, ptStartSubPath } = stroke;
    if (center.x !== ptStartSubPath.x || center.y !== ptStartSubPath.y) lineTo(stroke, ptStartSubPath);
    stroke.angleOut = stroke.subPathAngle;
    const turn = mathDiff(stroke.angleIn, stroke.angleOut);
    if (turn !== 0) {
      const insideSide = turn < 0 ? 1 : 0;
      inside(stroke, insideSide, stroke.subPathLineLength);
      outside(stroke, 1 - insideSide, stroke.subPathLineLength);
    }
    borderClose(stroke.borders[0], false);
    borderClose(stroke.borders[1], true);
    return;
  }
  // An open path: a cap, the left border reversed, and a cap back to the right border.
  addCap(stroke, stroke.angleIn, 0);
  addReverseLeft(stroke, true);
  stroke.center = { ...stroke.ptStartSubPath };
  addCap(stroke, stroke.subPathAngle + SW_ANGLE_PI, 0);
  borderClose(stroke.borders[0], false);
}

/** `strokeReset`: a stroke of the shape's width, cap, join and mitre limit under `transform`. */
export function strokeReset(rs: RenderShape, transform: Matrix): SwStroke {
  const stroke = rs.stroke!;
  const join = stroke.join;
  return {
    angleIn: 0,
    angleOut: 0,
    center: { x: 0, y: 0 },
    lineLength: 0,
    subPathAngle: 0,
    ptStartSubPath: { x: 0, y: 0 },
    subPathLineLength: 0,
    width: toSwCoord(halfStroke(stroke.width)),
    miterlimit: Math.trunc(f32(stroke.miterlimit * 65536)),
    cap: stroke.cap,
    join,
    joinSaved: join,
    borders: [emptyBorder(), emptyBorder()],
    sx: f32(Math.sqrt(f32(f32(transform.e11 * transform.e11) + f32(transform.e21 * transform.e21)))),
    sy: f32(Math.sqrt(f32(f32(transform.e12 * transform.e12) + f32(transform.e22 * transform.e22)))),
    firstPt: false,
    closedSubPath: false,
    handleWideStrokes: false,
  };
}

/** `strokeParseOutline`: strokes each contour, or answers false for one that starts on a control point. */
export function strokeParseOutline(stroke: SwStroke, outline: SwOutline): boolean {
  let first = 0;
  for (let i = 0; i < outline.cntrs.length; i++) {
    const last = outline.cntrs[i]!;
    if (last <= first) {
      first = last + 1;
      continue;
    }
    if (outline.types[first] === SW_CURVE_TYPE_CUBIC) return false;
    strokeContour(stroke, outline, first, last, outline.closed[i] ?? false);
    first = last + 1;
  }
  return true;
}

function strokeContour(
  stroke: SwStroke,
  outline: SwOutline,
  first: number,
  last: number,
  isClosed: boolean
): void {
  const { pts, types } = outline;
  const start = pts[first]!;
  beginSubPath(stroke, start, isClosed);
  let pt = first;
  let type = first + 1;
  while (pt < last) {
    if (types[type] === SW_CURVE_TYPE_POINT) {
      pt++;
      type++;
      lineTo(stroke, pts[pt]!);
      continue;
    }
    pt += 3;
    type += 3;
    if (pt <= last) cubicTo(stroke, pts[pt - 2]!, pts[pt - 1]!, pts[pt]!);
    else if (pt - 1 === last) cubicTo(stroke, pts[pt - 2]!, pts[pt - 1]!, start);
    else break;
  }
  if (!stroke.firstPt) endSubPath(stroke);
}

/** `strokeExportOutline`: both borders as one outline, contours ending at each end tag. */
export function strokeExportOutline(stroke: SwStroke): SwOutline {
  const outline = emptyOutline();
  for (const border of stroke.borders) exportBorder(border, outline);
  return outline;
}

function exportBorder(border: StrokeBorder, outline: SwOutline): void {
  border.pts.forEach((pt, i) => {
    const tag = border.tags[i]!;
    const index = outline.pts.length;
    outline.pts.push({ ...pt });
    outline.types.push(tag & TAG_POINT ? SW_CURVE_TYPE_POINT : SW_CURVE_TYPE_CUBIC);
    if (tag & TAG_END) outline.cntrs.push(index);
  });
}
