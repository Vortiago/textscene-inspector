/**
 * The glyph hints of FreeType's auto-hinter (`afhints.c`): the points of one outline with their
 * directions, the segments and edges each axis finds in them, and the steps that move the points
 * once the writing system has fitted the edges to the grid. Every writing system shares them.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 2003-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ftDivFix, ftMulFix } from '../fontMetrics';
import { outlineOrientation, type ScaledOutline } from '../glyphContours';

export const Dimension = { HORZ: 0, VERT: 1 } as const;
export type DimensionValue = (typeof Dimension)[keyof typeof Dimension];

/** `AF_Direction`: the direction of a run of points, or none for one too slanted to be a stem. */
export const Direction = { NONE: 4, RIGHT: 1, LEFT: -1, UP: 2, DOWN: -2 } as const;

export const PointFlag = {
  CONIC: 1 << 0,
  CUBIC: 1 << 1,
  CONTROL: (1 << 0) | (1 << 1),
  TOUCH_X: 1 << 2,
  TOUCH_Y: 1 << 3,
  WEAK_INTERPOLATION: 1 << 4,
  NEAR: 1 << 5,
  IGNORE: 1 << 6,
} as const;

export const EdgeFlag = {
  NORMAL: 0,
  ROUND: 1 << 0,
  SERIF: 1 << 1,
  DONE: 1 << 2,
  NEUTRAL: 1 << 3,
  NO_BLUE: 1 << 4,
} as const;

export const ScalerFlag = { NO_HORIZONTAL: 1, NO_VERTICAL: 2, NO_ADVANCE: 4 } as const;

/** `FT_CURVE_TAG_ON`, `FT_CURVE_TAG_CONIC` and `FT_CURVE_TAG_CUBIC`. */
const CURVE_TAG_ON = 1;
const CURVE_TAG_CONIC = 0;
const CURVE_TAG_CUBIC = 2;
const CURVE_TAG_MASK = 3;

/** `AF_WidthRec`: a width or a blue zone height in font units, scaled, and fitted to the grid. */
export interface Width {
  org: number;
  cur: number;
  fit: number;
}

export const newWidth = (org = 0): Width => ({ org, cur: 0, fit: 0 });

/**
 * `AF_PointRec`. `index` is the point's place in the outline, which FreeType reads as pointer
 * arithmetic. `u` and `v` hold a coordinate pair while an axis is analysed, and offsets to the
 * next and previous strong points while the outline loads.
 */
export interface Point {
  readonly index: number;
  flags: number;
  inDir: number;
  outDir: number;
  ox: number;
  oy: number;
  fx: number;
  fy: number;
  x: number;
  y: number;
  u: number;
  v: number;
  next: Point;
  prev: Point;
}

/** `AF_SegmentRec`: a run of points along one axis. `index` is its place in the axis's segments. */
export interface Segment {
  index: number;
  flags: number;
  dir: number;
  pos: number;
  delta: number;
  minCoord: number;
  maxCoord: number;
  height: number;
  edge: Edge | null;
  edgeNext: Segment | null;
  link: Segment | null;
  serif: Segment | null;
  score: number;
  len: number;
  first: Point;
  last: Point;
}

/** `AF_EdgeRec`: segments at one position. `index` is its place in the axis's sorted edges. */
export interface Edge {
  index: number;
  fpos: number;
  opos: number;
  pos: number;
  flags: number;
  dir: number;
  scale: number;
  blueEdge: Width | null;
  link: Edge | null;
  serif: Edge | null;
  score: number;
  first: Segment;
  last: Segment;
}

export interface AxisHints {
  segments: Segment[];
  edges: Edge[];
  majorDir: number;
}

/** The scale and flags a writing system sets on the hints of a glyph (`af_*_hints_init`). */
export interface GlyphHints {
  xScale: number;
  xDelta: number;
  yScale: number;
  yDelta: number;
  unitsPerEm: number;
  points: Point[];
  /** The first point of each contour. */
  contours: Point[];
  contourYMinima: number[];
  contourYMaxima: number[];
  readonly axis: readonly [AxisHints, AxisHints];
  scalerFlags: number;
  otherFlags: number;
}

/** FreeType's `FT_Short`: the low 16 bits of `value`, signed. */
export const toShort = (value: number): number => (value << 16) >> 16;

/** C's integer division, which truncates toward zero. */
export const divide = (dividend: number, divisor: number): number => Math.trunc(dividend / divisor);

/** `FT_PIX_ROUND` on any integer, which `pixRound` limits to none. */
export const pixRound = (value: number): number => Math.floor((value + 32) / 64) * 64;
export const pixFloor = (value: number): number => Math.floor(value / 64) * 64;

/** `af_glyph_hints_init`: empty hints at the identity scale. */
export function newGlyphHints(unitsPerEm: number): GlyphHints {
  return {
    xScale: 0x10000,
    xDelta: 0,
    yScale: 0x10000,
    yDelta: 0,
    unitsPerEm,
    points: [],
    contours: [],
    contourYMinima: [],
    contourYMaxima: [],
    axis: [
      { segments: [], edges: [], majorDir: Direction.UP },
      { segments: [], edges: [], majorDir: Direction.LEFT },
    ],
    scalerFlags: 0,
    otherFlags: 0,
  };
}

/** `af_sort_pos`: an insertion sort, ascending. */
export function sortPositions(table: number[], count: number): void {
  for (let i = 1; i < count; i++) {
    for (let j = i; j > 0; j--) {
      if (table[j]! >= table[j - 1]!) break;
      [table[j], table[j - 1]] = [table[j - 1]!, table[j]!];
    }
  }
}

/**
 * `af_sort_and_quantize_widths`: sorts `widths` and merges the ones within `threshold` of the
 * first of their run into their mean. Returns the widths left.
 */
export function sortAndQuantizeWidths(widths: Width[], threshold: number): Width[] {
  const count = widths.length;
  if (count <= 1) return widths;
  for (let i = 1; i < count; i++) {
    for (let j = i; j > 0; j--) {
      if (widths[j]!.org >= widths[j - 1]!.org) break;
      [widths[j], widths[j - 1]] = [widths[j - 1]!, widths[j]!];
    }
  }
  let curIndex = 0;
  let curValue = widths[curIndex]!.org;
  for (let i = 1; i < count; i++) {
    if (widths[i]!.org - curValue > threshold || i === count - 1) {
      let sum = 0;
      if (widths[i]!.org - curValue <= threshold && i === count - 1) i++;
      let j = curIndex;
      for (; j < i; j++) {
        sum += widths[j]!.org;
        widths[j]!.org = 0;
      }
      widths[curIndex]!.org = divide(sum, j);
      if (i < count - 1) {
        curIndex = i + 1;
        curValue = widths[curIndex]!.org;
      }
    }
  }
  // The first width stays even when it is zero, as FreeType keeps it.
  return [widths[0]!, ...widths.slice(1).filter((width) => width.org !== 0)];
}

/**
 * `af_axis_hints_new_edge`: a new edge at `fpos`, inserted to keep the edges sorted, ascending or,
 * for top-to-bottom hinting, descending. An edge at the same position in the major direction goes
 * after the others there.
 */
export function newEdge(
  axis: AxisHints,
  fpos: number,
  dir: number,
  isTopToBottom: boolean,
  first: Segment
): Edge {
  const { edges } = axis;
  let at = edges.length;
  while (at > 0) {
    const before = edges[at - 1]!;
    if (isTopToBottom ? before.fpos > fpos : before.fpos < fpos) break;
    if (before.fpos === fpos && dir === axis.majorDir) break;
    at--;
  }
  const edge: Edge = {
    index: at,
    fpos,
    opos: 0,
    pos: 0,
    flags: 0,
    dir,
    scale: 0,
    blueEdge: null,
    link: null,
    serif: null,
    score: 0,
    first,
    last: first,
  };
  edges.splice(at, 0, edge);
  return edge;
}

/** Numbers the edges in their sorted order, which the hinters compare as FreeType compares pointers. */
export function indexEdges(axis: AxisHints): void {
  axis.edges.forEach((edge, index) => (edge.index = index));
}

/** `af_direction_compute`: the direction of `(dx, dy)`, or none when it is not within 1/14 of an axis. */
export function directionOf(dx: number, dy: number): number {
  let dir: number;
  let longer: number;
  let shorter: number;
  if (dy >= dx) {
    if (dy >= -dx) [dir, longer, shorter] = [Direction.UP, dy, dx];
    else [dir, longer, shorter] = [Direction.LEFT, -dx, dy];
  } else if (dy >= -dx) [dir, longer, shorter] = [Direction.RIGHT, dx, dy];
  else [dir, longer, shorter] = [Direction.DOWN, -dy, dx];
  return longer <= 14 * Math.abs(shorter) ? Direction.NONE : dir;
}

/** `FT_HYPOT`: the length of a vector by the "alpha max plus beta min" estimate. */
function approximateLength(x: number, y: number): number {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  return ax > ay ? ax + ((3 * ay) >> 3) : ay + ((3 * ax) >> 3);
}

/** `ft_corner_is_flat` (`ftcalc.c`): whether the two legs are nearly as long as the line across them. */
function isCornerFlat(inX: number, inY: number, outX: number, outY: number): boolean {
  const lengthIn = approximateLength(inX, inY);
  const lengthOut = approximateLength(outX, outY);
  const lengthAcross = approximateLength(inX + outX, inY + outY);
  return lengthIn + lengthOut - lengthAcross < lengthAcross >> 4;
}

function pointFlagsOfTag(tag: number): number {
  switch (tag & CURVE_TAG_MASK) {
    case CURVE_TAG_CONIC:
      return PointFlag.CONIC;
    case CURVE_TAG_CUBIC:
      return PointFlag.CUBIC;
    default:
      return 0;
  }
}

/**
 * `af_glyph_hints_reload`: loads `outline` in font units into the hints, scaled by the hints'
 * scale, links each contour's points, gives each point its in and out direction, and marks the
 * points that only follow their neighbours as weak.
 */
export function reloadHints(hints: GlyphHints, outline: ScaledOutline): void {
  for (const axis of hints.axis) {
    axis.segments = [];
    axis.edges = [];
  }
  const [horizontal, vertical] = hints.axis;
  horizontal.majorDir = Direction.UP;
  vertical.majorDir = Direction.LEFT;
  // FreeType's PostScript orientation is a fill on the left, against TrueType's on the right.
  if (outlineOrientation(outline) === 'fillLeft') {
    horizontal.majorDir = Direction.DOWN;
    vertical.majorDir = Direction.RIGHT;
  }
  hints.points = loadPoints(hints, outline);
  hints.contours = contourStarts(hints.points, outline.contourEnds);
  hints.contourYMinima = hints.contours.map(() => 0);
  hints.contourYMaxima = hints.contours.map(() => 0);
  if (hints.points.length === 0) return;
  computeDirections(hints);
  markInflections(hints.points);
  markWeakPoints(hints.points);
}

/** The near limit of `af_glyph_hints_reload`: 20 font units at 2048 units per em. */
const nearLimitOf = (unitsPerEm: number): number => Math.trunc((20 * unitsPerEm) / 2048);

function loadPoints(hints: GlyphHints, outline: ScaledOutline): Point[] {
  const pointCount = outline.x.length;
  const points: Point[] = [];
  for (let index = 0; index < pointCount; index++) {
    const fx = toShort(outline.x[index]!);
    const fy = toShort(outline.y[index]!);
    const ox = ftMulFix(outline.x[index]!, hints.xScale) + hints.xDelta;
    const oy = ftMulFix(outline.y[index]!, hints.yScale) + hints.yDelta;
    points.push({
      index,
      flags: pointFlagsOfTag(outline.tags[index]!),
      inDir: Direction.NONE,
      outDir: Direction.NONE,
      ox,
      oy,
      fx,
      fy,
      x: ox,
      y: oy,
      u: 0,
      v: 0,
      next: null as unknown as Point,
      prev: null as unknown as Point,
    });
  }
  const nearLimit = nearLimitOf(hints.unitsPerEm);
  let first = 0;
  for (const end of outline.contourEnds) {
    let prev = points[end]!;
    for (let index = first; index <= end; index++) {
      const point = points[index]!;
      if (Math.abs(point.fx - prev.fx) + Math.abs(point.fy - prev.fy) < nearLimit)
        prev.flags |= PointFlag.NEAR;
      point.prev = prev;
      prev.next = point;
      prev = point;
    }
    first = end + 1;
  }
  return points;
}

function contourStarts(points: readonly Point[], contourEnds: readonly number[]): Point[] {
  let first = 0;
  return contourEnds.map((end) => {
    const start = points[first]!;
    first = end + 1;
    return start;
  });
}

/**
 * The direction of each run of strong points: a point closer than the near limit to the run's
 * start is weak, and the points between two strong ones take the direction from one to the other.
 * `u` and `v` hold the offsets to the next and the previous strong point.
 */
function computeDirections(hints: GlyphHints): void {
  const { points } = hints;
  const nearLimit = nearLimitOf(hints.unitsPerEm);
  const nearLimit2 = 2 * nearLimit - 1;
  for (const contourStart of hints.contours) {
    let point = contourStart;
    let prev = contourStart.prev;
    // Start the contour at a point far enough from the one before it.
    while (prev !== contourStart) {
      if (Math.abs(point.fx - prev.fx) + Math.abs(point.fy - prev.fy) >= nearLimit2) break;
      point = prev;
      prev = prev.prev;
    }
    const first = point;
    let curr = first;
    curr.u = first.index - curr.index;
    first.v = -curr.u;
    let outX = 0;
    let outY = 0;
    let next = first;
    do {
      point = next;
      next = point.next;
      outX += next.fx - point.fx;
      outY += next.fy - point.fy;
      if (Math.abs(outX) + Math.abs(outY) < nearLimit) {
        next.flags |= PointFlag.WEAK_INTERPOLATION;
        continue;
      }
      curr.u = next.index - curr.index;
      next.v = -curr.u;
      const outDir = directionOf(outX, outY);
      curr.outDir = outDir;
      for (curr = curr.next; curr !== next; curr = curr.next) {
        curr.inDir = outDir;
        curr.outDir = outDir;
      }
      next.inDir = outDir;
      curr.u = first.index - curr.index;
      first.v = -curr.u;
      outX = 0;
      outY = 0;
    } while (next !== first);
  }
  void points;
}

/** A strong point with no direction either way that goes on in the same quadrant is weak. */
function markInflections(points: readonly Point[]): void {
  for (const point of points) {
    if (point.flags & PointFlag.WEAK_INTERPOLATION) continue;
    if (point.inDir !== Direction.NONE || point.outDir !== Direction.NONE) continue;
    const nextU = points[point.index + point.u]!;
    const prevV = points[point.index + point.v]!;
    const inX = point.fx - prevV.fx;
    const inY = point.fy - prevV.fy;
    const outX = nextU.fx - point.fx;
    const outY = nextU.fy - point.fy;
    if ((inX ^ outX) >= 0 && (inY ^ outY) >= 0) {
      point.flags |= PointFlag.WEAK_INTERPOLATION;
      prevV.u = nextU.index - prevV.index;
      nextU.v = -prevV.u;
    }
  }
}

/** Control points, points inside a straight run, flat corners and spikes are weak. */
function markWeakPoints(points: readonly Point[]): void {
  for (const point of points) {
    if (point.flags & PointFlag.WEAK_INTERPOLATION) continue;
    if (isWeakPoint(points, point)) point.flags |= PointFlag.WEAK_INTERPOLATION;
  }
}

function isWeakPoint(points: readonly Point[], point: Point): boolean {
  if (point.flags & PointFlag.CONTROL) return true;
  if (point.outDir === point.inDir) {
    if (point.outDir !== Direction.NONE) return true;
    const nextU = points[point.index + point.u]!;
    const prevV = points[point.index + point.v]!;
    if (!isCornerFlat(point.fx - prevV.fx, point.fy - prevV.fy, nextU.fx - point.fx, nextU.fy - point.fy))
      return false;
    prevV.u = nextU.index - prevV.index;
    nextU.v = -prevV.u;
    return true;
  }
  return point.inDir === -point.outDir;
}

/** `af_glyph_hints_save`: the hinted points over `outline`, with their tags. */
export function saveHints(hints: GlyphHints, outline: ScaledOutline): void {
  for (const point of hints.points) {
    outline.x[point.index] = point.x;
    outline.y[point.index] = point.y;
    outline.tags[point.index] =
      point.flags & PointFlag.CONIC
        ? CURVE_TAG_CONIC
        : point.flags & PointFlag.CUBIC
          ? CURVE_TAG_CUBIC
          : CURVE_TAG_ON;
  }
}

/** Calls `visit` on each point of `segment`, first to last. */
export function forEachSegmentPoint(segment: Segment, visit: (point: Point) => void): void {
  for (let point = segment.first; ; point = point.next) {
    visit(point);
    if (point === segment.last) break;
  }
}

/** `af_glyph_hints_align_edge_points`: each point of a segment with an edge moves onto the edge. */
export function alignEdgePoints(hints: GlyphHints, dim: DimensionValue): void {
  for (const segment of hints.axis[dim].segments) {
    const { edge } = segment;
    if (!edge) continue;
    forEachSegmentPoint(segment, (point) => {
      if (dim === Dimension.HORZ) {
        point.x = edge.pos;
        point.flags |= PointFlag.TOUCH_X;
      } else {
        point.y = edge.pos;
        point.flags |= PointFlag.TOUCH_Y;
      }
    });
  }
}

/** Above this many edges, `af_glyph_hints_align_strong_points` searches them by halving. */
const LINEAR_EDGE_SEARCH_LIMIT = 8;

/**
 * `af_glyph_hints_align_strong_points`: each untouched strong point moves with the edges around
 * it, by the offset of the nearest outer edge, or in proportion between the two it lies between.
 */
export function alignStrongPoints(hints: GlyphHints, dim: DimensionValue): void {
  const { edges } = hints.axis[dim];
  if (edges.length === 0) return;
  const touchFlag = dim === Dimension.HORZ ? PointFlag.TOUCH_X : PointFlag.TOUCH_Y;
  for (const point of hints.points) {
    if (point.flags & touchFlag) continue;
    if (point.flags & PointFlag.WEAK_INTERPOLATION) continue;
    const [fu, ou] = dim === Dimension.VERT ? [point.fy, point.oy] : [point.fx, point.ox];
    const u = strongPointPosition(edges, fu, ou);
    if (dim === Dimension.HORZ) point.x = u;
    else point.y = u;
    point.flags |= touchFlag;
  }
}

function strongPointPosition(edges: readonly Edge[], fu: number, ou: number): number {
  const firstEdge = edges[0]!;
  if (firstEdge.fpos - fu >= 0) return firstEdge.pos - (firstEdge.opos - ou);
  const lastEdge = edges[edges.length - 1]!;
  if (fu - lastEdge.fpos >= 0) return lastEdge.pos + (ou - lastEdge.opos);

  let min = 0;
  let max = edges.length;
  if (max <= LINEAR_EDGE_SEARCH_LIMIT) {
    let nn = 0;
    for (; nn < max; nn++) if (edges[nn]!.fpos >= fu) break;
    if (edges[nn]!.fpos === fu) return edges[nn]!.pos;
    min = nn;
  } else {
    while (min < max) {
      const mid = (max + min) >> 1;
      const fpos = edges[mid]!.fpos;
      if (fu < fpos) max = mid;
      else if (fu > fpos) min = mid + 1;
      else return edges[mid]!.pos;
    }
  }
  const before = edges[min - 1]!;
  const after = edges[min]!;
  if (before.scale === 0) before.scale = ftDivFix(after.pos - before.pos, after.fpos - before.fpos);
  return before.pos + ftMulFix(fu - before.fpos, before.scale);
}

/** `af_iup_shift`: the points from `p1` to `p2` move by the shift of `ref`. */
function shiftUntouched(points: readonly Point[], p1: number, p2: number, ref: number): void {
  const delta = points[ref]!.u - points[ref]!.v;
  if (delta === 0) return;
  for (let p = p1; p < ref; p++) points[p]!.u = points[p]!.v + delta;
  for (let p = ref + 1; p <= p2; p++) points[p]!.u = points[p]!.v + delta;
}

/** `af_iup_interp`: the points from `p1` to `p2` move in proportion between `ref1` and `ref2`. */
function interpolateUntouched(
  points: readonly Point[],
  p1: number,
  p2: number,
  ref1: number,
  ref2: number
): void {
  if (p1 > p2) return;
  let first = points[ref1]!;
  let second = points[ref2]!;
  if (first.v > second.v) [first, second] = [second, first];
  const { v: v1, u: u1 } = first;
  const { v: v2, u: u2 } = second;
  const d1 = u1 - v1;
  const d2 = u2 - v2;
  const isFlat = u1 === u2 || v1 === v2;
  const scale = isFlat ? 0 : ftDivFix(u2 - u1, v2 - v1);
  for (let p = p1; p <= p2; p++) {
    const point = points[p]!;
    let u = point.v;
    if (u <= v1) u += d1;
    else if (u >= v2) u += d2;
    else u = isFlat ? u1 : u1 + ftMulFix(u - v1, scale);
    point.u = u;
  }
}

/**
 * `af_glyph_hints_align_weak_points`: each untouched point of a contour moves in proportion
 * between the touched points around it, or with the one touched point of its contour.
 */
export function alignWeakPoints(hints: GlyphHints, dim: DimensionValue): void {
  const { points } = hints;
  const touchFlag = dim === Dimension.HORZ ? PointFlag.TOUCH_X : PointFlag.TOUCH_Y;
  for (const point of points) {
    point.u = dim === Dimension.HORZ ? point.x : point.y;
    point.v = dim === Dimension.HORZ ? point.ox : point.oy;
  }
  for (const contourStart of hints.contours) {
    const firstPoint = contourStart.index;
    const endPoint = contourStart.prev.index;
    let point = firstPoint;
    while (point <= endPoint && !(points[point]!.flags & touchFlag)) point++;
    if (point > endPoint) continue;
    const firstTouched = point;
    let lastTouched: number;
    for (;;) {
      while (point < endPoint && points[point + 1]!.flags & touchFlag) point++;
      lastTouched = point;
      point++;
      while (point <= endPoint && !(points[point]!.flags & touchFlag)) point++;
      if (point > endPoint) break;
      interpolateUntouched(points, lastTouched + 1, point - 1, lastTouched, point);
    }
    if (lastTouched === firstTouched) shiftUntouched(points, firstPoint, endPoint, firstTouched);
    else {
      if (lastTouched < endPoint)
        interpolateUntouched(points, lastTouched + 1, endPoint, lastTouched, firstTouched);
      // FreeType compares with the first point of the outline here, not of the contour.
      if (firstTouched > 0)
        interpolateUntouched(points, firstPoint, firstTouched - 1, lastTouched, firstTouched);
    }
  }
  for (const point of points) {
    if (dim === Dimension.HORZ) point.x = point.u;
    else point.y = point.u;
  }
}
