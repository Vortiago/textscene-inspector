/**
 * The features the Latin writing system finds in a glyph along one axis (`aflatin.c`): segments,
 * the runs of points in the axis's direction; their links into stems and serifs; the edges that
 * group segments at one position; and the blue zone each horizontal edge snaps to.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 2003-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { toInt16 } from '../../../../../godot/variant/intWidth';
import { ftDivFix, ftMulFix } from '../fontMetrics';
import {
  Dimension,
  Direction,
  EdgeFlag,
  PointFlag,
  divide,
  indexEdges,
  newEdge,
  type AxisHints,
  type DimensionValue,
  type Edge,
  type GlyphHints,
  type Point,
  type Segment,
  type Width,
} from './afHints';

/** `FLAT_THRESHOLD`: a run this much of the em wide or less is round when its ends are control points. */
export const flatThresholdOf = (unitsPerEm: number): number => divide(unitsPerEm, 14);

/** `AF_LATIN_CONSTANT`: `value` in font units at 2048 units per em, scaled to the face's. */
export const latinConstant = (unitsPerEm: number, value: number): number => divide(value * unitsPerEm, 2048);

/** A glyph with more segments than this on one axis gets none, as FreeType gives up on it. */
const MAX_SEGMENTS = 1000;

function newSegment(axis: AxisHints, dir: number, first: Point): Segment {
  const segment: Segment = {
    index: axis.segments.length,
    flags: EdgeFlag.NORMAL,
    dir,
    pos: 0,
    delta: 0,
    minCoord: 0,
    maxCoord: 0,
    height: 0,
    edge: null,
    edgeNext: null,
    link: null,
    serif: null,
    score: 32000,
    len: 0,
    first,
    last: first,
  };
  axis.segments.push(segment);
  return segment;
}

/** The extent of a run of points while `computeSegments` walks it. */
interface Run {
  minPos: number;
  maxPos: number;
  minCoord: number;
  maxCoord: number;
  minFlags: number;
  maxFlags: number;
  minOnCoord: number;
  maxOnCoord: number;
}

const EMPTY_RUN: Run = {
  minPos: 32000,
  maxPos: -32000,
  minCoord: 32000,
  maxCoord: -32000,
  minFlags: 0,
  maxFlags: 0,
  minOnCoord: 32000,
  maxOnCoord: -32000,
};

function runOf(point: Point): Run {
  const isControl = (point.flags & PointFlag.CONTROL) !== 0;
  return {
    minPos: point.u,
    maxPos: point.u,
    minCoord: point.v,
    maxCoord: point.v,
    minFlags: point.flags,
    maxFlags: point.flags,
    minOnCoord: isControl ? 32000 : point.v,
    maxOnCoord: isControl ? -32000 : point.v,
  };
}

function extendRun(run: Run, point: Point): void {
  run.minPos = Math.min(run.minPos, point.u);
  run.maxPos = Math.max(run.maxPos, point.u);
  if (point.v < run.minCoord) {
    run.minCoord = point.v;
    run.minFlags = point.flags;
  }
  if (point.v > run.maxCoord) {
    run.maxCoord = point.v;
    run.maxFlags = point.flags;
  }
  if (point.flags & PointFlag.CONTROL) return;
  run.minOnCoord = Math.min(run.minOnCoord, point.v);
  run.maxOnCoord = Math.max(run.maxOnCoord, point.v);
}

/** Widens `run` to also cover `other`. */
function mergeRun(run: Run, other: Run): void {
  run.minPos = Math.min(run.minPos, other.minPos);
  run.maxPos = Math.max(run.maxPos, other.maxPos);
  if (other.minCoord < run.minCoord) [run.minCoord, run.minFlags] = [other.minCoord, other.minFlags];
  if (other.maxCoord > run.maxCoord) [run.maxCoord, run.maxFlags] = [other.maxCoord, other.maxFlags];
  run.minOnCoord = Math.min(run.minOnCoord, other.minOnCoord);
  run.maxOnCoord = Math.max(run.maxOnCoord, other.maxOnCoord);
}

/** Whether a run is round: one of its extreme points is a control point, and its on points span little. */
const isRoundRun = (run: Run, flatThreshold: number): boolean =>
  ((run.minFlags | run.maxFlags) & PointFlag.CONTROL) !== 0 &&
  run.maxOnCoord - run.minOnCoord < flatThreshold;

function closeSegment(segment: Segment, run: Run, last: Point, flatThreshold: number): void {
  segment.last = last;
  segment.pos = toInt16((run.minPos + run.maxPos) >> 1);
  segment.delta = toInt16((run.maxPos - run.minPos) >> 1);
  if (isRoundRun(run, flatThreshold)) segment.flags |= EdgeFlag.ROUND;
  segment.minCoord = toInt16(run.minCoord);
  segment.maxCoord = toInt16(run.maxCoord);
  segment.height = segment.maxCoord - segment.minCoord;
}

/** Sets `u` and `v` of each point to its coordinates along and across `dim`, in font units. */
function loadAxisCoordinates(hints: GlyphHints, dim: DimensionValue): void {
  for (const point of hints.points) {
    point.u = dim === Dimension.HORZ ? point.fx : point.fy;
    point.v = dim === Dimension.HORZ ? point.fy : point.fx;
  }
}

/**
 * The point to start a contour's walk at: the first of the run in the major direction that the
 * contour's start is in, so that the run stays one segment.
 */
function walkStart(contourStart: Point, majorDir: number): Point {
  let point = contourStart;
  if (point.flags & PointFlag.IGNORE) return point;
  if (Math.abs(point.prev.outDir) !== majorDir || Math.abs(point.outDir) !== majorDir) return point;
  const last = point;
  for (;;) {
    point = point.prev;
    if (Math.abs(point.outDir) !== majorDir) return point.next;
    if (point === last) return point;
  }
}

/**
 * `af_latin_hints_compute_segments`: the segments of `dim`, each a run of points in its major
 * direction. A run that continues the one before it in the same contour merges into it.
 */
export function computeSegments(hints: GlyphHints, dim: DimensionValue): void {
  const axis = hints.axis[dim];
  const flatThreshold = flatThresholdOf(hints.unitsPerEm);
  const majorDir = Math.abs(axis.majorDir);
  axis.segments = [];
  loadAxisCoordinates(hints, dim);
  for (const contourStart of hints.contours) {
    if (!walkContour(axis, walkStart(contourStart, majorDir), majorDir, flatThreshold)) {
      axis.segments = [];
      return;
    }
  }
  for (const segment of axis.segments) extendHeightToNeighbours(segment);
}

/** Walks one contour from `last` round to it. False when the axis has too many segments. */
function walkContour(axis: AxisHints, last: Point, majorDir: number, flatThreshold: number): boolean {
  let segmentDir = majorDir;
  let segment: Segment | null = null;
  let prevSegment: Segment | null = null;
  let run: Run = { ...EMPTY_RUN };
  let prevRun: Run = { ...EMPTY_RUN };
  let isOnEdge = false;
  let isPassed = false;
  let point = last;
  for (;;) {
    if (isOnEdge) {
      extendRun(run, point);
      if (point.flags & PointFlag.IGNORE || point.outDir !== segmentDir || point === last) {
        const current = segment!;
        if (point.flags & PointFlag.IGNORE || !prevSegment || current.first !== prevSegment.last) {
          closeSegment(current, run, point, flatThreshold);
          prevSegment = current;
          prevRun = { ...run };
        } else {
          prevRun = mergeIntoPrevious(axis, prevSegment, current, run, prevRun, point, flatThreshold);
        }
        isOnEdge = false;
        segment = null;
      }
    }
    if (point === last) {
      if (isPassed) return true;
      isPassed = true;
    }
    if (
      !(point.flags & PointFlag.IGNORE) &&
      !isOnEdge &&
      (Math.abs(point.outDir) === majorDir || point === point.prev)
    ) {
      if (axis.segments.length > MAX_SEGMENTS) return false;
      segmentDir = point.outDir;
      segment = newSegment(axis, segmentDir, point);
      if (prevSegment) prevSegment = axis.segments[segment.index - 1]!;
      run = runOf(point);
      isOnEdge = true;
      if (point === point.prev) {
        segment.pos = toInt16(run.minPos);
        if (point.flags & PointFlag.CONTROL) segment.flags |= EdgeFlag.ROUND;
        segment.minCoord = toInt16(point.v);
        segment.maxCoord = toInt16(point.v);
        segment.height = 0;
        isOnEdge = false;
        segment = null;
      }
    }
    point = point.next;
  }
}

/**
 * A segment that starts where the one before it ends joins it: into one run when both go the same
 * way, or else into the taller of the two. The current segment is dropped. Returns the run the
 * previous segment covers now.
 */
function mergeIntoPrevious(
  axis: AxisHints,
  prevSegment: Segment,
  segment: Segment,
  run: Run,
  prevRun: Run,
  point: Point,
  flatThreshold: number
): Run {
  axis.segments.pop();
  if (prevSegment.last.inDir === point.inDir) {
    mergeRun(run, prevRun);
    prevSegment.flags &= ~EdgeFlag.ROUND;
    closeSegment(prevSegment, run, point, flatThreshold);
    // FreeType keeps the previous run's extent as it was, though the segment now spans both.
    return prevRun;
  }
  if (Math.abs(prevRun.maxCoord - prevRun.minCoord) > Math.abs(run.maxCoord - run.minCoord)) {
    prevRun.minPos = Math.min(prevRun.minPos, run.minPos);
    prevRun.maxPos = Math.max(prevRun.maxPos, run.maxPos);
    prevSegment.last = point;
    prevSegment.pos = toInt16((prevRun.minPos + prevRun.maxPos) >> 1);
    prevSegment.delta = toInt16((prevRun.maxPos - prevRun.minPos) >> 1);
    return prevRun;
  }
  run.minPos = Math.min(run.minPos, prevRun.minPos);
  run.maxPos = Math.max(run.maxPos, prevRun.maxPos);
  closeSegment(segment, run, point, flatThreshold);
  Object.assign(prevSegment, { ...segment, index: prevSegment.index });
  return { ...run };
}

/** A segment's height grows by half the step to each neighbour beyond its ends. */
function extendHeightToNeighbours(segment: Segment): void {
  const { first, last } = segment;
  const isAscending = first.v < last.v;
  const before = first.prev.v;
  const after = last.next.v;
  if (isAscending) {
    if (before < first.v) segment.height = toInt16(segment.height + ((first.v - before) >> 1));
    if (after > last.v) segment.height = toInt16(segment.height + ((after - last.v) >> 1));
  } else {
    if (before > first.v) segment.height = toInt16(segment.height + ((before - first.v) >> 1));
    if (after < last.v) segment.height = toInt16(segment.height + ((last.v - after) >> 1));
  }
}

/**
 * `af_latin_hints_link_segments`: links each segment in the major direction with the opposite one
 * that scores best as the other side of a stem. A link that is not mutual becomes a serif.
 */
export function linkSegments(hints: GlyphHints, dim: DimensionValue, widths: readonly Width[]): void {
  const { segments, majorDir } = hints.axis[dim];
  const maxWidth = widths.length > 0 ? widths[widths.length - 1]!.org : 0;
  const lengthThreshold = Math.max(latinConstant(hints.unitsPerEm, 8), 1);
  const lengthScore = latinConstant(hints.unitsPerEm, 6000);
  const distanceScore = 3000;
  for (const seg1 of segments) {
    if (seg1.dir !== majorDir) continue;
    for (const seg2 of segments) {
      if (seg1.dir + seg2.dir !== 0 || seg2.pos <= seg1.pos) continue;
      const overlap = Math.min(seg1.maxCoord, seg2.maxCoord) - Math.max(seg1.minCoord, seg2.minCoord);
      if (overlap < lengthThreshold) continue;
      const dist = seg2.pos - seg1.pos;
      let demerit = dist;
      if (maxWidth) {
        const delta = divide(dist << 10, maxWidth) - (1 << 10);
        demerit = delta > 10000 ? 32000 : delta > 0 ? divide(delta * delta, distanceScore) : 0;
      }
      const score = demerit + divide(lengthScore, overlap);
      if (score < seg1.score) [seg1.score, seg1.link] = [score, seg2];
      if (score < seg2.score) [seg2.score, seg2.link] = [score, seg1];
    }
  }
  for (const seg1 of segments) {
    const seg2 = seg1.link;
    if (seg2 && seg2.link !== seg1) {
      seg1.link = null;
      seg1.serif = seg2.link;
    }
  }
}

/** The thresholds of `af_latin_hints_compute_edges` in font units. */
function edgeThresholds(hints: GlyphHints, dim: DimensionValue, edgeDistanceThreshold: number) {
  const scale = dim === Dimension.HORZ ? hints.xScale : hints.yScale;
  const scaledDistance = Math.min(ftMulFix(edgeDistanceThreshold, scale), 64 / 4);
  return {
    scale,
    segmentLength: dim === Dimension.HORZ ? ftDivFix(64, hints.yScale) : 0,
    segmentWidth: ftDivFix(32, scale),
    edgeDistance: ftDivFix(scaledDistance, scale),
  };
}

/** Adds `segment` to the end of the edge's ring of segments. */
export function appendToEdge(edge: Edge, segment: Segment): void {
  segment.edgeNext = edge.first;
  edge.last.edgeNext = segment;
  edge.last = segment;
}

/**
 * `af_latin_hints_compute_edges`: groups the segments of `dim` at nearly one position into edges,
 * links the edges as their segments link, and marks an edge round when most of its segments are.
 */
export function computeEdges(
  hints: GlyphHints,
  dim: DimensionValue,
  edgeDistanceThreshold: number,
  isTopToBottom: boolean
): void {
  const axis = hints.axis[dim];
  axis.edges = [];
  const thresholds = edgeThresholds(hints, dim, edgeDistanceThreshold);
  const isNear = (segment: Segment, edge: Edge): boolean =>
    Math.abs(segment.pos - edge.fpos) < thresholds.edgeDistance;
  for (const segment of axis.segments) {
    if (
      segment.height < thresholds.segmentLength ||
      segment.delta > thresholds.segmentWidth ||
      segment.dir === Direction.NONE
    )
      continue;
    if (segment.serif && 2 * segment.height < 3 * thresholds.segmentLength) continue;
    const found = axis.edges.find((edge) => isNear(segment, edge) && edge.dir === segment.dir);
    if (found) {
      appendToEdge(found, segment);
      continue;
    }
    const edge = newEdge(axis, segment.pos, segment.dir, isTopToBottom, segment);
    edge.opos = ftMulFix(segment.pos, thresholds.scale);
    edge.pos = edge.opos;
    segment.edgeNext = segment;
  }
  for (const segment of axis.segments) {
    if (segment.dir !== Direction.NONE) continue;
    const found = axis.edges.find((edge) => isNear(segment, edge));
    if (found) appendToEdge(found, segment);
  }
  indexEdges(axis);
  for (const edge of axis.edges) forEachEdgeSegment(edge, (segment) => (segment.edge = edge));
  for (const edge of axis.edges) linkEdge(edge, (segment) => !!segment?.edge);
}

export function forEachEdgeSegment(edge: Edge, visit: (segment: Segment) => void): void {
  let segment = edge.first;
  do {
    visit(segment);
    segment = segment.edgeNext!;
  } while (segment !== edge.first);
}

/**
 * Links `edge` to the edge of its segments' links, or of their serifs, and sets its roundness. A
 * link or serif counts when `isLinkable`: the Latin system needs it on an edge, the CJK one does not.
 */
export function linkEdge(edge: Edge, isLinkable: (segment: Segment | null) => boolean): void {
  let roundCount = 0;
  let straightCount = 0;
  forEachEdgeSegment(edge, (segment) => {
    if (segment.flags & EdgeFlag.ROUND) roundCount++;
    else straightCount++;
    const isSerif = isLinkable(segment.serif) && segment.serif!.edge !== edge;
    if (!isLinkable(segment.link) && !isSerif) return;
    const seg2 = isSerif ? segment.serif! : segment.link!;
    let edge2 = isSerif ? edge.serif : edge.link;
    if (!edge2 || Math.abs(segment.pos - seg2.pos) < Math.abs(edge.fpos - edge2.fpos)) edge2 = seg2.edge;
    if (isSerif) {
      edge.serif = edge2;
      edge2!.flags |= EdgeFlag.SERIF;
    } else edge.link = edge2;
  });
  edge.flags = EdgeFlag.NORMAL;
  if (roundCount > 0 && roundCount >= straightCount) edge.flags |= EdgeFlag.ROUND;
  if (edge.serif && edge.link) edge.serif = null;
}

/** A blue zone as `computeBlueEdges` reads it. */
export interface BlueZone {
  ref: Width;
  shoot: Width;
  flags: number;
}

export const LatinBlueFlag = {
  ACTIVE: 1 << 0,
  TOP: 1 << 1,
  SUB_TOP: 1 << 2,
  NEUTRAL: 1 << 3,
  ADJUSTMENT: 1 << 4,
  BOTTOM: 1 << 5,
  BOTTOM_SMALL: 1 << 6,
} as const;

/**
 * `af_latin_hints_compute_blue_edges`: each horizontal edge snaps to the nearest active blue zone
 * within half a pixel, its reference or, for a round edge past it, its overshoot.
 */
export function computeBlueEdges(hints: GlyphHints, blues: readonly BlueZone[], scale: number): void {
  const axis = hints.axis[Dimension.VERT];
  for (const edge of axis.edges) {
    if (edge.flags & EdgeFlag.NO_BLUE) continue;
    let bestDist = Math.min(ftMulFix(divide(hints.unitsPerEm, 40), scale), 64 / 2);
    let bestBlue: Width | null = null;
    let isBestNeutral = false;
    for (const blue of blues) {
      if (!(blue.flags & LatinBlueFlag.ACTIVE)) continue;
      const isTop = (blue.flags & (LatinBlueFlag.TOP | LatinBlueFlag.SUB_TOP)) !== 0;
      const isNeutral = (blue.flags & LatinBlueFlag.NEUTRAL) !== 0;
      const isMajorDir = edge.dir === axis.majorDir;
      if (!(isTop !== isMajorDir || isNeutral)) continue;
      let dist = ftMulFix(Math.abs(edge.fpos - blue.ref.org), scale);
      if (dist < bestDist) [bestDist, bestBlue, isBestNeutral] = [dist, blue.ref, isNeutral];
      if (!(edge.flags & EdgeFlag.ROUND) || dist === 0 || isNeutral) continue;
      const isUnderRef = edge.fpos < blue.ref.org;
      if (isTop === isUnderRef) continue;
      dist = ftMulFix(Math.abs(edge.fpos - blue.shoot.org), scale);
      if (dist < bestDist) [bestDist, bestBlue, isBestNeutral] = [dist, blue.shoot, isNeutral];
    }
    if (!bestBlue) continue;
    edge.blueEdge = bestBlue;
    if (isBestNeutral) edge.flags |= EdgeFlag.NEUTRAL;
  }
}
