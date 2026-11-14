/**
 * ThorVG's shape in the software engine (`tvgSwShape.cpp`): a path through its transform as an
 * outline in 26.6, its dashes, its region, and the coverage of its fill and of its stroke.
 *
 * Portions ported from ThorVG (MIT License). Copyright (c) 2020 - 2024 the ThorVG project.
 */
import { bezierLength, lineLength, splitBezier, splitLine, type Bezier, type Line } from '../bezier';
import { f32, FLOAT_EPSILON, isZero, type Matrix, type Point } from '../math';
import { PathCommand } from '../renderPath';
import type { RenderShape } from '../renderShape';
import { copyBBox, emptyBBox, mathTransform, mathUpdateOutlineBBox, toSwCoord, type SwBBox } from './swMath';
import {
  emptyOutline,
  SW_CURVE_TYPE_CUBIC,
  SW_CURVE_TYPE_POINT,
  type SwOutline,
  type SwRle,
} from './swOutline';
import { rleRender } from './swRle';
import { strokeExportOutline, strokeParseOutline, strokeReset, type SwStroke } from './swStroke';

/** `DASH_PATTERN_THRESHOLD` (`tvgRender.h:38`): the length left of a segment that a dash no longer splits. */
const DASH_PATTERN_THRESHOLD = f32(0.001);

export interface SwShape {
  outline: SwOutline | null;
  stroke: SwStroke | null;
  rle: SwRle | null;
  strokeRle: SwRle | null;
  /** The region of the fill without the stroke, which a fill draws in. */
  bbox: SwBBox;
  /** An axis-aligned rectangle with no composition, which draws without coverage. */
  fastTrack: boolean;
}

export const swShape = (): SwShape => ({
  outline: null,
  stroke: null,
  rle: null,
  strokeRle: null,
  bbox: emptyBBox(),
  fastTrack: false,
});

/** Starts a contour where a line or curve follows a close with no move. */
function outlineBegin(outline: SwOutline): boolean {
  if (outline.pts.length === 0) return false;
  outline.cntrs.push(outline.pts.length - 1);
  outline.closed.push(false);
  outline.pts.push({ ...outline.pts[outline.cntrs.at(-1)!]! });
  outline.types.push(SW_CURVE_TYPE_POINT);
  return false;
}

function outlineEnd(outline: SwOutline): boolean {
  if (outline.pts.length === 0) return false;
  outline.cntrs.push(outline.pts.length - 1);
  outline.closed.push(false);
  return false;
}

function outlineMoveTo(outline: SwOutline, to: Point, transform: Matrix, isClosed = false): boolean {
  if (!isClosed) outlineEnd(outline);
  outline.pts.push(mathTransform(to, transform));
  outline.types.push(SW_CURVE_TYPE_POINT);
  return false;
}

function outlineLineTo(outline: SwOutline, to: Point, transform: Matrix): void {
  outline.pts.push(mathTransform(to, transform));
  outline.types.push(SW_CURVE_TYPE_POINT);
}

function outlineCubicTo(outline: SwOutline, ctrl1: Point, ctrl2: Point, to: Point, transform: Matrix): void {
  outline.pts.push(
    mathTransform(ctrl1, transform),
    mathTransform(ctrl2, transform),
    mathTransform(to, transform)
  );
  outline.types.push(SW_CURVE_TYPE_CUBIC, SW_CURVE_TYPE_CUBIC, SW_CURVE_TYPE_POINT);
}

/** Closes the current contour, or answers false where it has no point. */
function outlineClose(outline: SwOutline): boolean {
  const first = outline.cntrs.length > 0 ? outline.cntrs.at(-1)! + 1 : 0;
  if (outline.pts.length === first) return false;
  outline.pts.push({ ...outline.pts[first]! });
  outline.cntrs.push(outline.pts.length - 1);
  outline.types.push(SW_CURVE_TYPE_POINT);
  outline.closed.push(true);
  return true;
}

/** `SwDashStroke`: where the walk is in the pattern, and the outline of the dashes so far. */
interface DashStroke {
  readonly outline: SwOutline;
  readonly pattern: readonly number[];
  curLen: number;
  curIdx: number;
  ptStart: Point;
  ptCur: Point;
  isGap: boolean;
  move: boolean;
}

function nextDash(dash: DashStroke): void {
  dash.curIdx = (dash.curIdx + 1) % dash.pattern.length;
  dash.curLen = dash.pattern[dash.curIdx]!;
  dash.isGap = !dash.isGap;
}

/** Whether a dash piece starts a new contour: after a gap, or at the start of its dash. */
const startsDash = (dash: DashStroke): boolean =>
  dash.move || f32(dash.pattern[dash.curIdx]! - dash.curLen) < FLOAT_EPSILON;

function dashLineTo(dash: DashStroke, to: Point, transform: Matrix): void {
  let cur: Line = { pt1: dash.ptCur, pt2: to };
  let len = lineLength(cur.pt1, cur.pt2);
  if (isZero(len)) {
    outlineMoveTo(dash.outline, dash.ptCur, transform);
  } else if (len <= dash.curLen) {
    dash.curLen = f32(dash.curLen - len);
    if (!dash.isGap) {
      if (dash.move) {
        outlineMoveTo(dash.outline, dash.ptCur, transform);
        dash.move = false;
      }
      outlineLineTo(dash.outline, to, transform);
    }
  } else {
    while (f32(len - dash.curLen) > DASH_PATTERN_THRESHOLD) {
      let right = cur;
      if (dash.curLen > 0) {
        len = f32(len - dash.curLen);
        const split = splitLine(cur, dash.curLen);
        right = split.right;
        if (!dash.isGap) {
          if (startsDash(dash)) {
            outlineMoveTo(dash.outline, split.left.pt1, transform);
            dash.move = false;
          }
          outlineLineTo(dash.outline, split.left.pt2, transform);
        }
      }
      nextDash(dash);
      cur = right;
      dash.ptCur = cur.pt1;
      dash.move = true;
    }
    dash.curLen = f32(dash.curLen - len);
    if (!dash.isGap) {
      if (dash.move) {
        outlineMoveTo(dash.outline, cur.pt1, transform);
        dash.move = false;
      }
      outlineLineTo(dash.outline, cur.pt2, transform);
    }
    if (dash.curLen < 1 && toSwCoord(len) > 1) nextDash(dash);
  }
  dash.ptCur = to;
}

function dashCubicTo(dash: DashStroke, ctrl1: Point, ctrl2: Point, to: Point, transform: Matrix): void {
  let cur: Bezier = { start: dash.ptCur, ctrl1, ctrl2, end: to };
  let len = bezierLength(cur);
  if (isZero(len)) {
    outlineMoveTo(dash.outline, dash.ptCur, transform);
  } else if (len <= dash.curLen) {
    dash.curLen = f32(dash.curLen - len);
    if (!dash.isGap) {
      if (dash.move) {
        outlineMoveTo(dash.outline, dash.ptCur, transform);
        dash.move = false;
      }
      outlineCubicTo(dash.outline, ctrl1, ctrl2, to, transform);
    }
  } else {
    while (f32(len - dash.curLen) > DASH_PATTERN_THRESHOLD) {
      let right = cur;
      if (dash.curLen > 0) {
        len = f32(len - dash.curLen);
        const split = splitBezier(cur, dash.curLen);
        right = split.right;
        if (!dash.isGap) {
          if (startsDash(dash)) {
            outlineMoveTo(dash.outline, split.left.start, transform);
            dash.move = false;
          }
          outlineCubicTo(dash.outline, split.left.ctrl1, split.left.ctrl2, split.left.end, transform);
        }
      }
      nextDash(dash);
      cur = right;
      dash.ptCur = right.start;
      dash.move = true;
    }
    dash.curLen = f32(dash.curLen - len);
    if (!dash.isGap) {
      if (dash.move) {
        outlineMoveTo(dash.outline, cur.start, transform);
        dash.move = false;
      }
      outlineCubicTo(dash.outline, cur.ctrl1, cur.ctrl2, cur.end, transform);
    }
    if (dash.curLen < f32(0.1) && toSwCoord(len) > 1) nextDash(dash);
  }
  dash.ptCur = to;
}

function dashMoveTo(dash: DashStroke, offIdx: number, offset: number, pt: Point): void {
  dash.curIdx = offIdx % dash.pattern.length;
  dash.curLen = f32(dash.pattern[dash.curIdx]! - offset);
  dash.isGap = offIdx % 2 === 1;
  dash.ptStart = dash.ptCur = pt;
  dash.move = true;
}

/** Where the offset puts the walk: the pattern entry, and how far into it. An odd pattern runs twice. */
function dashOffset(pattern: readonly number[], offset: number): { offIdx: number; offset: number } {
  if (isZero(offset)) return { offIdx: 0, offset };
  const isOdd = pattern.length % 2 === 1;
  let patternLength = pattern.reduce((sum, entry) => f32(sum + entry), 0);
  if (isOdd) patternLength = f32(patternLength * 2);
  let left = f32(offset % patternLength);
  if (left < 0) left = f32(left + patternLength);
  let offIdx = 0;
  for (; offIdx < pattern.length * (isOdd ? 2 : 1); offIdx++) {
    const entry = pattern[offIdx % pattern.length]!;
    if (left < entry) break;
    left = f32(left - entry);
  }
  return { offIdx, offset: left };
}

/**
 * `_genDashOutline`: the outline of the dashes along the path. The SVG loader sets no trim, so
 * the trimmed walk of `_trimPattern` has no caller here.
 */
function genDashOutline(rs: RenderShape, transform: Matrix): SwOutline | null {
  const { cmds, pts } = rs.path;
  const stroke = rs.stroke!;
  if (cmds.length === 0 || pts.length === 0 || stroke.dashPattern.length === 0) return null;
  const { offIdx, offset } = dashOffset(stroke.dashPattern, stroke.dashOffset);
  const dash: DashStroke = {
    outline: emptyOutline(),
    pattern: stroke.dashPattern,
    curLen: 0,
    curIdx: 0,
    ptStart: { x: 0, y: 0 },
    ptCur: { x: 0, y: 0 },
    isGap: false,
    move: true,
  };
  dash.outline.fillRule = rs.rule;
  let cmd = 0;
  let pt = 0;
  if (cmds[0] === PathCommand.MoveTo) {
    dashMoveTo(dash, offIdx, offset, pts[0]!);
    cmd++;
    pt++;
  }
  // The walk takes one command fewer than the path holds.
  for (let left = cmds.length - 1; left > 0; left--, cmd++) {
    switch (cmds[cmd]) {
      case PathCommand.Close:
        dashLineTo(dash, dash.ptStart, transform);
        break;
      case PathCommand.MoveTo:
        dashMoveTo(dash, offIdx, offset, pts[pt++]!);
        break;
      case PathCommand.LineTo:
        dashLineTo(dash, pts[pt++]!, transform);
        break;
      case PathCommand.CubicTo:
        dashCubicTo(dash, pts[pt]!, pts[pt + 1]!, pts[pt + 2]!, transform);
        pt += 3;
        break;
    }
  }
  outlineEnd(dash.outline);
  return dash.outline;
}

/** `_axisAlignedRect`: whether the outline is a rectangle along the axes. */
function isAxisAlignedRect(outline: SwOutline): boolean {
  if (outline.pts.length !== 5 || outline.types[2] === SW_CURVE_TYPE_CUBIC) return false;
  const [pt1, pt2, pt3, pt4] = outline.pts as [Point, Point, Point, Point];
  const same = (p: Point, x: number, y: number): boolean => p.x === x && p.y === y;
  return (
    (same(pt2, pt1.x, pt3.y) && same(pt4, pt3.x, pt1.y)) ||
    (same(pt2, pt3.x, pt1.y) && same(pt4, pt1.x, pt3.y))
  );
}

/** `_genOutline`: the path through `transform`, or false for a path with no data. */
function genOutline(shape: SwShape, rs: RenderShape, transform: Matrix, hasComposite: boolean): boolean {
  const { cmds, pts } = rs.path;
  if (cmds.length === 0 || pts.length === 0) return false;
  const outline = emptyOutline();
  let isClosed = false;
  let pt = 0;
  for (const cmd of cmds) {
    switch (cmd) {
      case PathCommand.Close:
        if (!isClosed) isClosed = outlineClose(outline);
        break;
      case PathCommand.MoveTo:
        isClosed = outlineMoveTo(outline, pts[pt++]!, transform, isClosed);
        break;
      case PathCommand.LineTo:
        if (isClosed) isClosed = outlineBegin(outline);
        outlineLineTo(outline, pts[pt++]!, transform);
        break;
      case PathCommand.CubicTo:
        if (isClosed) isClosed = outlineBegin(outline);
        outlineCubicTo(outline, pts[pt]!, pts[pt + 1]!, pts[pt + 2]!, transform);
        pt += 3;
        break;
    }
  }
  if (!isClosed) outlineEnd(outline);
  outline.fillRule = rs.rule;
  shape.outline = outline;
  shape.fastTrack = !hasComposite && isAxisAlignedRect(outline);
  return true;
}

/** `shapePrepare`: the outline and its region in `renderRegion`, or false where nothing is left to draw. */
export function shapePrepare(
  shape: SwShape,
  rs: RenderShape,
  transform: Matrix,
  clipRegion: SwBBox,
  renderRegion: SwBBox,
  hasComposite: boolean
): boolean {
  if (!genOutline(shape, rs, transform, hasComposite)) return false;
  const { pts, cntrs } = shape.outline!;
  if (!mathUpdateOutlineBBox(pts, cntrs.length > 0, clipRegion, renderRegion, shape.fastTrack)) return false;
  shape.bbox = copyBBox(renderRegion);
  if (renderRegion.max.x - renderRegion.min.x < 1 && renderRegion.max.y - renderRegion.min.y < 1)
    return false;
  return !(
    renderRegion.min.x >= clipRegion.max.x ||
    renderRegion.min.y >= clipRegion.max.y ||
    renderRegion.max.x <= clipRegion.min.x ||
    renderRegion.max.y <= clipRegion.min.y
  );
}

/** `shapeGenRle`: the fill's coverage. A fast-track rectangle needs none. */
export function shapeGenRle(shape: SwShape, isAntiAliased: boolean): boolean {
  if (shape.fastTrack) return true;
  shape.rle = rleRender(shape.outline!, shape.bbox, isAntiAliased);
  return true;
}

export function shapeResetStroke(shape: SwShape, rs: RenderShape, transform: Matrix): void {
  shape.stroke = strokeReset(rs, transform);
  shape.strokeRle = null;
}

/** `shapeGenStrokeRle`: the stroke's coverage, and its region in `renderRegion`. */
export function shapeGenStrokeRle(
  shape: SwShape,
  rs: RenderShape,
  transform: Matrix,
  clipRegion: SwBBox,
  renderRegion: SwBBox
): boolean {
  let outline: SwOutline | null;
  if (rs.stroke!.dashPattern.length > 0) {
    // The dash outline takes the place of the fill's, as it takes its pool slot.
    outline = genDashOutline(rs, transform);
    if (!outline) return false;
    shape.outline = outline;
  } else {
    if (!shape.outline && !genOutline(shape, rs, transform, false)) return false;
    outline = shape.outline!;
  }
  if (!strokeParseOutline(shape.stroke!, outline)) return false;
  const strokeOutline = strokeExportOutline(shape.stroke!);
  const hasRegion = mathUpdateOutlineBBox(
    strokeOutline.pts,
    strokeOutline.cntrs.length > 0,
    clipRegion,
    renderRegion,
    false
  );
  shape.strokeRle = rleRender(strokeOutline, renderRegion, true);
  return hasRegion;
}
