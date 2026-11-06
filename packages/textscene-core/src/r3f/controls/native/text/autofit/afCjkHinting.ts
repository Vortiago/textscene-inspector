/**
 * The CJK writing system's hinting of one glyph (`afcjk.c`), which the Indic system shares: it
 * finds stems as the Latin system does, links them by distance alone, fits blue edges, then each
 * stem centred on its place, and moves the points by their edge's shift. Godot loads glyphs for
 * the normal target, so stems adjust and no axis snaps.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 2006-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ScaledOutline } from '../glyphContours';
import { ftDivFix, ftMulDiv, ftMulFix, pixFloor } from '../fontMetrics';
import {
  alignStrongPoints,
  alignWeakPoints,
  Dimension,
  divide,
  EdgeFlag,
  forEachSegmentPoint,
  alignSerifEdge,
  doneNeighbours,
  evenlySpacedStems,
  indexEdges,
  keepStemSpacing,
  newEdge,
  PointFlag,
  reloadHints,
  saveHints,
  type DimensionValue,
  type Edge,
  type GlyphHints,
  type Segment,
  type Width,
} from './afHints';
import { CjkBlueFlag, type CjkMetrics } from './afCjkMetrics';
import {
  appendToEdge,
  computeSegments,
  forEachEdgeSegment,
  latinConstant,
  linkEdge,
} from './afLatinFeatures';

/** `af_cjk_hints_compute_segments`: the Latin segments, round when no two on points follow each other. */
function computeCjkSegments(hints: GlyphHints, dim: DimensionValue): void {
  computeSegments(hints, dim);
  for (const segment of hints.axis[dim].segments) {
    segment.flags &= ~EdgeFlag.ROUND;
    let point = segment.first;
    let isPreviousOff = (point.flags & PointFlag.CONTROL) !== 0;
    while (point !== segment.last) {
      point = point.next;
      const isOff = (point.flags & PointFlag.CONTROL) !== 0;
      if (!isPreviousOff && !isOff) break;
      if (point === segment.last) segment.flags |= EdgeFlag.ROUND;
      isPreviousOff = isOff;
    }
  }
}

/** Whether `distance` at `length` of overlap beats the segment's link, as `af_cjk_hints_link_segments` scores. */
const isBetterLink = (segment: Segment, distance: number, length: number): boolean =>
  distance * 8 < segment.score * 9 && (distance * 8 < segment.score * 7 || segment.len < length);

/**
 * `af_cjk_hints_link_segments`: links each segment in the major direction with the nearest
 * opposite one that overlaps it enough, drops a link that a thinner stem inside it outdoes, and
 * turns a link that is not mutual into a serif.
 */
function linkCjkSegments(hints: GlyphHints, dim: DimensionValue): void {
  const { segments, majorDir } = hints.axis[dim];
  const lengthThreshold = latinConstant(hints.unitsPerEm, 8);
  const distanceThreshold = ftDivFix(64 * 3, dim === Dimension.HORZ ? hints.xScale : hints.yScale);
  for (const seg1 of segments) {
    if (seg1.dir !== majorDir) continue;
    for (const seg2 of segments) {
      if (seg2 === seg1 || seg1.dir + seg2.dir !== 0) continue;
      const distance = seg2.pos - seg1.pos;
      if (distance < 0) continue;
      const length = Math.min(seg1.maxCoord, seg2.maxCoord) - Math.max(seg1.minCoord, seg2.minCoord);
      if (length < lengthThreshold) continue;
      if (isBetterLink(seg1, distance, length)) [seg1.score, seg1.len, seg1.link] = [distance, length, seg2];
      if (isBetterLink(seg2, distance, length)) [seg2.score, seg2.len, seg2.link] = [distance, length, seg1];
    }
  }
  for (const seg1 of segments) dropOutdoneLink(segments, seg1, distanceThreshold);
  for (const seg1 of segments) {
    const seg2 = seg1.link;
    if (!seg2 || seg2.link === seg1) continue;
    seg1.link = null;
    if (seg2.score < distanceThreshold || seg1.score < seg2.score * 4) seg1.serif = seg2.link;
  }
}

/**
 * A thin stem `seg1` that a wider stem holds: when `seg1` is three times as long, the wider stem's
 * sides become serifs of it, and otherwise `seg1`'s own link goes.
 */
function dropOutdoneLink(segments: readonly Segment[], seg1: Segment, distanceThreshold: number): void {
  const link1 = seg1.link;
  if (!link1 || link1.link !== seg1 || link1.pos <= seg1.pos || seg1.score >= distanceThreshold) return;
  for (const seg2 of segments) {
    if (seg2.pos > seg1.pos || seg1 === seg2) continue;
    const link2 = seg2.link;
    if (!link2 || link2.link !== seg2 || link2.pos < link1.pos) continue;
    if (seg1.pos === seg2.pos && link1.pos === link2.pos) continue;
    if (seg2.score <= seg1.score || seg1.score * 4 <= seg2.score) continue;
    if (seg1.len < seg2.len * 3) {
      seg1.link = link1.link = null;
      return;
    }
    for (const segment of segments) {
      if (segment.link === seg2) [segment.link, segment.serif] = [null, link1];
      else if (segment.link === link2) [segment.link, segment.serif] = [null, seg1];
    }
  }
}

/** `af_cjk_hints_compute_edges`: groups the segments into edges and links the edges as their segments link. */
function computeCjkEdges(hints: GlyphHints, metrics: CjkMetrics, dim: DimensionValue): void {
  const axis = hints.axis[dim];
  axis.edges = [];
  const scale = dim === Dimension.HORZ ? hints.xScale : hints.yScale;
  const unitsThreshold = metrics.axis[dim].edgeDistanceThreshold;
  const threshold = ftMulFix(unitsThreshold, scale) > 64 / 4 ? ftDivFix(64 / 4, scale) : unitsThreshold;
  for (const segment of axis.segments) {
    const found = nearestEdge(axis.edges, segment, threshold);
    if (found) {
      appendToEdge(found, segment);
      continue;
    }
    const edge = newEdge(axis, segment.pos, segment.dir, false, segment);
    edge.opos = edge.pos = ftMulFix(segment.pos, scale);
    segment.edgeNext = segment;
  }
  indexEdges(axis);
  for (const edge of axis.edges) forEachEdgeSegment(edge, (segment) => (segment.edge = edge));
  for (const edge of axis.edges) linkEdge(edge, (segment) => !!segment);
}

/** The nearest edge of the segment's direction within `threshold`, whose segments' links lie near the segment's link. */
function nearestEdge(edges: readonly Edge[], segment: Segment, threshold: number): Edge | null {
  let found: Edge | null = null;
  let best = 0xffff;
  for (const edge of edges) {
    if (edge.dir !== segment.dir) continue;
    const distance = Math.abs(segment.pos - edge.fpos);
    if (distance >= threshold || distance >= best) continue;
    if (segment.link && !areLinksNear(edge, segment.link, threshold)) continue;
    best = distance;
    found = edge;
  }
  return found;
}

/** Whether the links of the edge's segments lie within `threshold` of `link`, up to the first that does not. */
function areLinksNear(edge: Edge, link: Segment, threshold: number): boolean {
  let segment = edge.first;
  do {
    if (segment.link && Math.abs(link.pos - segment.link.pos) >= threshold) return false;
    segment = segment.edgeNext!;
  } while (segment !== edge.first);
  return true;
}

/**
 * `af_cjk_hints_compute_blue_edges`: each edge of the vertical axis takes the nearest active blue
 * zone within half a pixel on its side, the zone's reference or overshoot, whichever is nearer.
 */
function computeCjkBlueEdges(hints: GlyphHints, metrics: CjkMetrics): void {
  const axis = hints.axis[Dimension.VERT];
  const { blues, scale } = metrics.axis[Dimension.VERT];
  const bestDist0 = Math.min(ftMulFix(divide(metrics.unitsPerEm, 40), scale), 64 / 2);
  for (const edge of axis.edges) {
    let bestDist = bestDist0;
    let bestBlue: Width | null = null;
    for (const blue of blues) {
      if (!(blue.flags & CjkBlueFlag.ACTIVE)) continue;
      const isTop = (blue.flags & CjkBlueFlag.TOP) !== 0;
      if (isTop === (edge.dir === axis.majorDir)) continue;
      const isShootNearer = Math.abs(edge.fpos - blue.ref.org) > Math.abs(edge.fpos - blue.shoot.org);
      const compare = isShootNearer ? blue.shoot : blue.ref;
      const dist = ftMulFix(Math.abs(edge.fpos - compare.org), scale);
      if (dist < bestDist) [bestDist, bestBlue] = [dist, compare];
    }
    if (bestBlue) edge.blueEdge = bestBlue;
  }
}

/** A stem this far, in 1/64 px, from the standard width takes it, at least 48. */
const STANDARD_WIDTH_SNAP = 40;

/**
 * `af_cjk_compute_stem_width`. FreeType reads the standard width's `cur`, which it never scales, so
 * a stem under 40/64 px grows to 48/64 px. The light target keeps every width.
 */
function cjkStemWidth(metrics: CjkMetrics, dim: DimensionValue, width: number): number {
  if (metrics.scaler.renderMode === 'light') return width;
  const { widths } = metrics.axis[dim];
  let dist = Math.abs(width);
  if (widths.length > 0 && Math.abs(dist - widths[0]!.cur) < STANDARD_WIDTH_SNAP)
    dist = Math.max(widths[0]!.cur, 48);
  else if (dist < 54) dist += divide(54 - dist, 2);
  else if (dist < 3 * 64) dist = cjkMediumStemWidth(dist);
  return width < 0 ? -dist : dist;
}

/** The fitted width of a stem under 3 px: whole pixels plus a fraction rounded to 10/64 or 54/64, or kept. */
function cjkMediumStemWidth(dist: number): number {
  const fraction = dist & 63;
  const whole = pixFloor(dist);
  if (fraction < 10) return whole + fraction;
  if (fraction < 22) return whole + 10;
  if (fraction < 42) return whole + fraction;
  if (fraction < 54) return whole + 54;
  return whole + fraction;
}

/** `af_cjk_align_linked_edge`. */
function alignCjkLinkedEdge(metrics: CjkMetrics, dim: DimensionValue, base: Edge, stem: Edge): void {
  stem.pos = base.pos + cjkStemWidth(metrics, dim, stem.opos - base.opos);
}

/**
 * `af_hint_normal_stem`: fits the stem's width, centres it on its place moved by `anchor`, and
 * shifts it to the nearer whole pixel for both sides. The light target shifts a stem at most
 * `LIGHT_MAX_SHIFT`. Returns the shift.
 */
function hintNormalStem(
  metrics: CjkMetrics,
  dim: DimensionValue,
  edge: Edge,
  edge2: Edge,
  anchor: number
): number {
  const isLight = metrics.scaler.renderMode === 'light';
  const length = cjkStemWidth(metrics, dim, edge2.opos - edge.opos);
  const pos1 = divide(edge.opos + edge2.opos, 2) + anchor - divide(length, 2);
  const threshold = isLight ? lightStemThreshold(dim, edge, edge2) : 64;
  const shift = stemShift(pos1, length, threshold);
  const delta = isLight ? Math.min(Math.max(shift, -LIGHT_MAX_SHIFT), LIGHT_MAX_SHIFT) : shift;
  if (edge.opos < edge2.opos) [edge.pos, edge2.pos] = [pos1 + delta, pos1 + delta + length];
  else [edge.pos, edge2.pos] = [pos1 + delta + length, pos1 + delta];
  return delta;
}

/** `AF_LIGHT_MODE_MAX_HORZ_GAP` and `AF_LIGHT_MODE_MAX_VERT_GAP` (`afcjk.c:1659-1660`), in 26.6. */
const LIGHT_MAX_HORZ_GAP = 9;
const LIGHT_MAX_VERT_GAP = 15;
/** `AF_LIGHT_MODE_MAX_DELTA_ABS` (`afcjk.c:1661`): the largest shift of a stem at the light target. */
const LIGHT_MAX_SHIFT = 14;

/**
 * The light target's threshold of a stem: a stem this short shifts only to put one side on the grid,
 * and a side this far off it leaves the stem in place. Round stems take the whole gap, others a third.
 */
function lightStemThreshold(dim: DimensionValue, edge: Edge, edge2: Edge): number {
  const gap = dim === Dimension.VERT ? LIGHT_MAX_HORZ_GAP : LIGHT_MAX_VERT_GAP;
  const isRound = edge.flags & edge2.flags & EdgeFlag.ROUND;
  return 64 - (isRound ? gap : Math.trunc(gap / 3));
}

/**
 * The shift of a stem from `pos1`, `length` long, that puts the side nearer the grid on it. The
 * normal target's `threshold` is a full pixel.
 */
function stemShift(pos1: number, length: number, threshold: number): number {
  const pos2 = pos1 + length;
  let dOff1 = pos1 - pixFloor(pos1);
  let dOff2 = pos2 - pixFloor(pos2);
  let uOff1 = 64 - dOff1;
  let uOff2 = 64 - dOff2;
  if (dOff1 === 0 || dOff2 === 0) return 0;
  if (length <= threshold) {
    if (dOff2 >= length) return 0;
    return uOff1 <= dOff2 ? uOff1 : -dOff2;
  }
  if (threshold < 64 && Math.max(dOff1, uOff1, dOff2, uOff2) >= threshold) return 0;
  let offset = length & 63;
  if (offset < 32) {
    if (uOff1 <= offset || dOff2 <= offset) return 0;
  } else offset = 64 - threshold;
  dOff1 = threshold - uOff1;
  uOff1 -= offset;
  uOff2 = threshold - dOff2;
  dOff2 -= offset;
  if (dOff1 <= uOff1) uOff1 = -dOff1;
  if (dOff2 <= uOff2) uOff2 = -dOff2;
  return Math.abs(uOff1) <= Math.abs(uOff2) ? uOff1 : uOff2;
}

/** Fits the blue edges and the edges they link. Returns the first edge fitted, the anchor. */
function hintCjkBlueEdges(metrics: CjkMetrics, dim: DimensionValue, edges: readonly Edge[]): Edge | null {
  let anchor: Edge | null = null;
  for (const edge of edges) {
    if (edge.flags & EdgeFlag.DONE) continue;
    let blue = edge.blueEdge;
    let edge1: Edge | null = null;
    let edge2 = edge.link;
    if (blue) edge1 = edge;
    else if (edge2?.blueEdge) [blue, edge1, edge2] = [edge2.blueEdge, edge2, edge];
    if (!edge1 || !blue) continue;
    edge1.pos = blue.fit;
    edge1.flags |= EdgeFlag.DONE;
    if (edge2 && !edge2.blueEdge) {
      alignCjkLinkedEdge(metrics, dim, edge1, edge2);
      edge2.flags |= EdgeFlag.DONE;
    }
    anchor ??= edge;
  }
  return anchor;
}

/**
 * Fits each stem not yet done, one pixel clear of the last. Returns how many edges it skips. The
 * first horizontal stem with no anchor sets the shift the stems after it take.
 */
function hintCjkStems(
  metrics: CjkMetrics,
  dim: DimensionValue,
  edges: readonly Edge[],
  blueAnchor: Edge | null
): number {
  let anchor = blueAnchor;
  let delta = 0;
  let skipped = 0;
  let lastStemPos: number | null = null;
  for (const edge of edges) {
    if (edge.flags & EdgeFlag.DONE) continue;
    const edge2 = edge.link;
    if (!edge2 || (lastStemPos !== null && Math.min(edge.pos, edge2.pos) < lastStemPos + 64)) {
      skipped++;
      continue;
    }
    if (edge2.blueEdge || edge2.index < edge.index) {
      alignCjkLinkedEdge(metrics, dim, edge2, edge);
      edge.flags |= EdgeFlag.DONE;
      if (!edge2.blueEdge) lastStemPos = edge.pos;
      continue;
    }
    if (dim !== Dimension.VERT && !anchor) delta = hintNormalStem(metrics, Dimension.HORZ, edge, edge2, 0);
    else hintNormalStem(metrics, dim, edge, edge2, delta);
    anchor = edge;
    edge.flags |= EdgeFlag.DONE;
    edge2.flags |= EdgeFlag.DONE;
    lastStemPos = edge2.pos;
  }
  return skipped;
}

/** `af_cjk_hint_edges` keeps the stem spacing only for stems whose edges link to the next. */
function keepCjkStemSpacing(edges: readonly Edge[]): void {
  const stems = evenlySpacedStems(edges);
  const isLinkedToNext = (edge: Edge): boolean => edge.link === edges[edge.index + 1];
  if (stems?.every(isLinkedToNext)) keepStemSpacing(edges, stems);
}

/** Fits the serifs left, then each edge left between the done edges around it. */
function hintCjkLoneEdges(edges: readonly Edge[], skipped: number): void {
  for (const edge of edges) {
    if (edge.flags & EdgeFlag.DONE || !edge.serif) continue;
    alignSerifEdge(edge.serif, edge);
    edge.flags |= EdgeFlag.DONE;
    skipped--;
  }
  if (skipped === 0) return;
  for (const edge of edges) {
    if (edge.flags & EdgeFlag.DONE) continue;
    const [before, after] = doneNeighbours(edges, edge);
    if (!before && after) alignSerifEdge(after, edge);
    else if (before && !after) alignSerifEdge(before, edge);
    else if (before && after) {
      edge.pos =
        after.fpos === before.fpos
          ? before.pos
          : before.pos + ftMulDiv(edge.fpos - before.fpos, after.pos - before.pos, after.fpos - before.fpos);
    }
  }
}

/** `af_cjk_hint_edges`. */
function hintCjkEdges(metrics: CjkMetrics, edges: readonly Edge[], dim: DimensionValue): void {
  const anchor = hintCjkBlueEdges(metrics, dim, edges);
  const skipped = hintCjkStems(metrics, dim, edges, anchor);
  if (dim === Dimension.HORZ) keepCjkStemSpacing(edges);
  if (skipped > 0) hintCjkLoneEdges(edges, skipped);
}

/** `af_cjk_align_edge_points` without snapping: each point moves by its edge's shift. */
function shiftEdgePoints(hints: GlyphHints, dim: DimensionValue): void {
  for (const edge of hints.axis[dim].edges) {
    const delta = edge.pos - edge.opos;
    forEachEdgeSegment(edge, (segment) =>
      forEachSegmentPoint(segment, (point) => {
        if (dim === Dimension.HORZ) {
          point.x += delta;
          point.flags |= PointFlag.TOUCH_X;
        } else {
          point.y += delta;
          point.flags |= PointFlag.TOUCH_Y;
        }
      })
    );
  }
}

/** `af_cjk_hints_apply`: hints `outline`, in font units, in place, scaling it. */
export function applyCjkHints(hints: GlyphHints, outline: ScaledOutline, metrics: CjkMetrics): void {
  reloadHints(hints, outline);
  const dims: readonly DimensionValue[] = [Dimension.HORZ, Dimension.VERT];
  for (const dim of dims) {
    computeCjkSegments(hints, dim);
    linkCjkSegments(hints, dim);
    computeCjkEdges(hints, metrics, dim);
  }
  computeCjkBlueEdges(hints, metrics);
  for (const dim of dims) {
    hintCjkEdges(metrics, hints.axis[dim].edges, dim);
    shiftEdgePoints(hints, dim);
    alignStrongPoints(hints, dim);
    alignWeakPoints(hints, dim);
  }
  saveHints(hints, outline);
}
