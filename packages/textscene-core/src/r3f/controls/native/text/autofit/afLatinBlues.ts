/**
 * The blue zones of a Latin-system style (`af_latin_metrics_init_blues`): for each blue string,
 * the extreme points of its characters, flat or round, give a zone's reference and overshoot
 * heights in font units.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 2003-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ScaledOutline } from '../glyphContours';
import { clustersOf, GlyphStyle, NONE_STYLE, shapeStyleCluster } from './afFace';
import { divide, newWidth } from './afHints';
import { flatThresholdOf, LatinBlueFlag, type BlueZone } from './afLatinFeatures';
import type { LatinMetrics } from './afLatinMetrics';
import type { BlueString } from './afStyles';

/** `AF_LatinBlueRec`: a blue zone, and the extent of the characters that gave it. */
export interface LatinBlue extends BlueZone {
  ascender: number;
  descender: number;
}

/** `AF_BLUE_PROPERTY_LATIN_*`. */
const BlueProperty = {
  TOP: 1,
  SUB_TOP: 2,
  NEUTRAL: 4,
  X_HEIGHT: 8,
  LONG: 16,
  CAPITAL_BOTTOM: 32,
  SMALL_BOTTOM: 64,
} as const;

const CURVE_TAG_ON = 1;
const isOn = (outline: ScaledOutline, point: number): boolean => outline.tags[point] === CURVE_TAG_ON;

/** A point within this many font units of the extremum's height continues its segment. */
const SEGMENT_HEIGHT_TOLERANCE = 5;
/** A step less steep than 1 in 20 continues the extremum's segment. */
const SEGMENT_SLOPE_LIMIT = 20;

/** Whether point `to` leaves the flat run of points around `(x, y)`. */
function leavesRun(outline: ScaledOutline, to: number, y: number, x: number): boolean {
  const dist = Math.abs(outline.y[to]! - y);
  return dist > SEGMENT_HEIGHT_TOLERANCE && Math.abs(outline.x[to]! - x) <= SEGMENT_SLOPE_LIMIT * dist;
}

/** The highest (top) or lowest point of a glyph, and the contour it is in. */
interface Extremum {
  point: number;
  y: number;
  contourFirst: number;
  contourLast: number;
}

/** The ascender and descender a blue string's characters reach, with their vertical offsets. */
interface Extent {
  ascender: number;
  descender: number;
}

function findExtremum(
  outline: ScaledOutline,
  isTop: boolean,
  yOffset: number,
  extent: Extent
): Extremum | null {
  let point = -1;
  let y = 0;
  let contourFirst = -1;
  let contourLast = -1;
  let last = -1;
  for (const end of outline.contourEnds) {
    const first = last + 1;
    last = end;
    if (last <= first) continue;
    for (let pp = first; pp <= last; pp++) {
      const py = outline.y[pp]!;
      const isBetter = point < 0 || (isTop ? py > y : py < y);
      if (isBetter) {
        point = pp;
        y = py;
      }
      if (isTop) {
        if (isBetter) extent.ascender = Math.max(extent.ascender, y + yOffset);
        else extent.descender = Math.min(extent.descender, py + yOffset);
      } else if (isBetter) extent.descender = Math.min(extent.descender, y + yOffset);
      else extent.ascender = Math.max(extent.ascender, py + yOffset);
    }
    if (point > contourLast) [contourFirst, contourLast] = [first, last];
  }
  return point < 0 ? null : { point, y, contourFirst, contourLast };
}

/**
 * The flat run of points around the extremum: its ends, its first and last on points, and the
 * point past its end, or the extremum when the run is the whole contour.
 */
interface Run {
  first: number;
  last: number;
  onFirst: number;
  onLast: number;
  y: number;
  pastEnd: number;
}

function runAround(outline: ScaledOutline, { point, y, contourFirst, contourLast }: Extremum): Run {
  const x = outline.x[point]!;
  const run: Run = { first: point, last: point, onFirst: -1, onLast: -1, y, pastEnd: point };
  if (isOn(outline, point)) run.onFirst = run.onLast = point;
  let prev = point;
  do {
    prev = prev > contourFirst ? prev - 1 : contourLast;
    if (leavesRun(outline, prev, y, x)) break;
    run.first = prev;
    if (isOn(outline, prev)) {
      run.onFirst = prev;
      if (run.onLast < 0) run.onLast = prev;
    }
  } while (prev !== point);
  let next = point;
  do {
    next = next < contourLast ? next + 1 : contourFirst;
    if (leavesRun(outline, next, y, x)) break;
    run.last = next;
    if (isOn(outline, next)) {
      run.onLast = next;
      if (run.onFirst < 0) run.onFirst = next;
    }
  } while (next !== point);
  run.pastEnd = next;
  return run;
}

/**
 * For a long blue, a run too short gives way to the next one long enough in the same direction at
 * a height near it, as `af_latin_metrics_init_blues` searches. Null when the extremum's contour is
 * a vertical line, which gives the glyph no extremum.
 */
function longRun(outline: ScaledOutline, extremum: Extremum, run: Run, unitsPerEm: number): Run | null {
  const { point, contourFirst, contourLast } = extremum;
  const lengthThreshold = divide(unitsPerEm, 25);
  const runLength = Math.abs(outline.x[run.last]! - outline.x[run.first]!);
  if (runLength >= lengthThreshold || run.last - run.first + 2 > contourLast - contourFirst) return run;
  const heightThreshold = divide(unitsPerEm, 4);
  const bestX = outline.x[point]!;
  let prev = point;
  do {
    prev = prev > contourFirst ? prev - 1 : contourLast;
    if (outline.x[prev] !== bestX) break;
  } while (prev !== point);
  if (prev === point) return null;
  const isLeftToRight = outline.x[prev]! < outline.x[point]!;
  const step = (index: number): number => (index < contourLast ? index + 1 : contourFirst);
  const { x, y } = outline;
  let first = run.last;
  let last = first;
  let isHit = false;
  let onFirst = 0;
  let onLast = 0;
  do {
    if (!isHit) {
      first = last;
      [onFirst, onLast] = isOn(outline, first) ? [first, first] : [-1, -1];
      isHit = true;
    }
    last = step(last);
    if (Math.abs(run.y - y[first]!) > heightThreshold) {
      isHit = false;
      continue;
    }
    const dist = Math.abs(y[last]! - y[first]!);
    if (dist > SEGMENT_HEIGHT_TOLERANCE && Math.abs(x[last]! - x[first]!) <= SEGMENT_SLOPE_LIMIT * dist) {
      isHit = false;
      continue;
    }
    if (isOn(outline, last)) {
      onLast = last;
      if (onFirst < 0) onFirst = last;
    }
    const isSameDirection = x[first]! < x[last]! === isLeftToRight;
    if (!isSameDirection || Math.abs(x[last]! - x[first]!) < lengthThreshold) continue;
    do {
      last = step(last);
      // FreeType's slope test here reads the point past the first run and the last height step.
      const height = Math.abs(y[last]! - y[first]!);
      if (
        height > SEGMENT_HEIGHT_TOLERANCE &&
        Math.abs(x[run.pastEnd]! - x[first]!) <= SEGMENT_SLOPE_LIMIT * dist
      ) {
        last = last > contourFirst ? last - 1 : contourLast;
        break;
      }
      onLast = last;
      if (isOn(outline, last)) {
        onLast = last;
        if (onFirst < 0) onFirst = last;
      }
    } while (last !== run.first);
    return { first, last, onFirst, onLast, y: y[first]!, pastEnd: run.pastEnd };
  } while (last !== run.first);
  return run;
}

/** The height a glyph gives a blue string, and whether it is round, or null for none. */
function glyphBlueHeight(
  metrics: LatinMetrics,
  glyph: number,
  yOffset: number,
  blue: BlueString,
  extent: Extent
) {
  const isTop = (blue.properties & (BlueProperty.TOP | BlueProperty.SUB_TOP)) !== 0;
  const outline = metrics.globals.face.unscaledGlyph(glyph);
  if (!outline || outline.x.length <= 2) return null;
  const extremum = findExtremum(outline, isTop, yOffset, extent);
  // A glyph whose contours are all single points still counts, at height 0 and flat.
  if (!extremum) return { y: 0, isRound: false };
  let run: Run | null = runAround(outline, extremum);
  if (blue.properties & BlueProperty.LONG) run = longRun(outline, extremum, run, metrics.unitsPerEm);
  if (!run) return null;
  const flatThreshold = flatThresholdOf(metrics.unitsPerEm);
  const isFlat =
    run.onFirst >= 0 &&
    run.onLast >= 0 &&
    Math.abs(outline.x[run.onLast]! - outline.x[run.onFirst]!) > flatThreshold;
  const isRound = !isFlat && (!isOn(outline, run.first) || !isOn(outline, run.last));
  if (isRound && blue.properties & BlueProperty.NEUTRAL) return null;
  return { y: run.y + yOffset, isRound };
}

/** The most extreme height of a cluster's glyphs for a blue string, or null for a cluster with none. */
function clusterBlueHeight(metrics: LatinMetrics, cluster: string, blue: BlueString, extent: Extent) {
  const isTop = (blue.properties & BlueProperty.TOP) !== 0;
  let best: { y: number; isRound: boolean } | null = null;
  for (const { glyph, yOffset } of shapeStyleCluster(metrics, cluster)) {
    if (glyph === 0) continue;
    const height = glyphBlueHeight(metrics, glyph, yOffset, blue, extent);
    if (!height) continue;
    if (!best || (isTop ? height.y > best.y : height.y < best.y)) best = height;
  }
  return best;
}

/** The flags of the zone a blue string gives (`AF_LATIN_BLUE_*`). */
function zoneFlags({ properties }: BlueString): number {
  let flags = 0;
  if (properties & BlueProperty.TOP) flags |= LatinBlueFlag.TOP;
  if (properties & BlueProperty.SUB_TOP) flags |= LatinBlueFlag.SUB_TOP;
  if (properties & BlueProperty.NEUTRAL) flags |= LatinBlueFlag.NEUTRAL;
  if (properties & BlueProperty.CAPITAL_BOTTOM) flags |= LatinBlueFlag.BOTTOM;
  if (properties & BlueProperty.SMALL_BOTTOM) flags |= LatinBlueFlag.BOTTOM_SMALL;
  if (properties & BlueProperty.X_HEIGHT) flags |= LatinBlueFlag.ADJUSTMENT;
  return flags;
}

/**
 * The zone of one blue string: the median flat height as its reference and the median round one as
 * its overshoot. An overshoot on the wrong side of the reference puts both at their mean.
 */
function blueZoneOf(metrics: LatinMetrics, blue: BlueString): LatinBlue | null {
  const flats: number[] = [];
  const rounds: number[] = [];
  const extent: Extent = { ascender: 0, descender: 0 };
  for (const cluster of clustersOf(blue.characters)) {
    const height = clusterBlueHeight(metrics, cluster, blue, extent);
    if (height) (height.isRound ? rounds : flats).push(height.y);
  }
  if (flats.length === 0 && rounds.length === 0) return null;
  rounds.sort((a, b) => a - b);
  flats.sort((a, b) => a - b);
  const roundMedian = rounds[rounds.length >> 1];
  const flatMedian = flats[flats.length >> 1];
  let ref = flatMedian ?? roundMedian!;
  let shoot = roundMedian ?? flatMedian!;
  const isTop = (blue.properties & (BlueProperty.TOP | BlueProperty.SUB_TOP)) !== 0;
  if (shoot !== ref && isTop !== shoot > ref) ref = shoot = divide(shoot + ref, 2);
  return { ref: newWidth(ref), shoot: newWidth(shoot), flags: zoneFlags(blue), ...extent };
}

/** The height a zone sorts by and overlaps at: the reference of a top zone, else the overshoot. */
const isTopZone = (blue: LatinBlue): boolean =>
  (blue.flags & (LatinBlueFlag.TOP | LatinBlueFlag.SUB_TOP)) !== 0;

/** `af_latin_sort_blue`: a stable sort by each zone's reference, for a top zone, or overshoot. */
function sortedZones(blues: readonly LatinBlue[]): LatinBlue[] {
  const key = (blue: LatinBlue): number => (isTopZone(blue) ? blue.ref.org : blue.shoot.org);
  return [...blues].sort((a, b) => key(a) - key(b));
}

/** Each zone's outer edge, the overshoot of a top zone or the reference of a bottom one, stops at the next zone's. */
function removeOverlaps(blues: readonly LatinBlue[]): void {
  const sorted = sortedZones(blues);
  const outer = (blue: LatinBlue) => (isTopZone(blue) ? blue.shoot : blue.ref);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = outer(sorted[i]!);
    const b = outer(sorted[i + 1]!);
    if (a.org > b.org) a.org = b.org;
  }
}

/**
 * `af_latin_metrics_init_blues`: the blue zones of the style. False when it finds none, which
 * moves the style's glyphs to the dummy style.
 */
export function initLatinBlues(metrics: LatinMetrics): boolean {
  const axis = metrics.axis[1];
  axis.blues = metrics.style.blues.flatMap((blue) => blueZoneOf(metrics, blue) ?? []);
  if (axis.blues.length > 0) {
    removeOverlaps(axis.blues);
    return true;
  }
  const { glyphStyles } = metrics.globals;
  for (let glyph = 0; glyph < glyphStyles.length; glyph++)
    if ((glyphStyles[glyph]! & GlyphStyle.MASK) === metrics.styleIndex) glyphStyles[glyph] = NONE_STYLE;
  return false;
}
