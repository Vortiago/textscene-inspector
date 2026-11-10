/**
 * The Latin writing system's handling of diacritics (`aflatin.c`, `afadjust.c`): a tilde stretches
 * to show its wave and sits on the pixel grid, a diacritic's edges keep clear of the blue zones of
 * its base glyph, and once hinted, a diacritic moves a pixel clear of its base glyph. The
 * adjustment database names which characters carry which.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 2025-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ftMulFix, pixRound } from '../fontMetrics';
import { Dimension, divide, EdgeFlag, PointFlag, type GlyphHints, type Point } from './afHints';
import type { LatinBlue } from './afLatinBlues';
import { LatinBlueFlag } from './afLatinFeatures';
import type { LatinMetrics } from './afLatinMetrics';
import { adjustmentFlagsOf } from './afReverseCharmap';

/** `AF_ADJUST_*` and `AF_IGNORE_*`. */
const Adjust = {
  UP: 0x1,
  DOWN: 0x2,
  UP2: 0x4,
  DOWN2: 0x8,
  TILDE_TOP: 0x10,
  TILDE_BOTTOM: 0x20,
  TILDE_TOP2: 0x40,
  TILDE_BOTTOM2: 0x80,
  IGNORE_CAPITAL_TOP: 0x100,
  IGNORE_CAPITAL_BOTTOM: 0x200,
  IGNORE_SMALL_TOP: 0x400,
  IGNORE_SMALL_BOTTOM: 0x800,
  NO_HEIGHT_CHECK: 0x1000,
} as const;

/** What the vertical separation after hinting needs: the glyph's adjustment flags and the tallest accent it moves. */
export interface DiacriticAdjustment {
  readonly codePointFlags: number;
  readonly accentHeightLimit: number;
}

/** `SUB_LONG` of two extrema: the extrema of a contour too short to measure wrap round to 1, as FreeType's do. */
function heightBetween(max: number, min: number): number {
  return max === -Infinity && min === Infinity ? 1 : max - min;
}

/** Calls `visit` on each point of the contour that starts at `first`, from the one after it round to it. */
function forEachContourPoint(first: Point, visit: (point: Point) => void): void {
  let point = first;
  do {
    point = point.next;
    visit(point);
  } while (point !== first);
}

/** `af_move_contour_vertically`. */
const moveContour = (first: Point, movement: number): void =>
  forEachContourPoint(first, (point) => (point.y += movement));

/** `af_compute_vertical_extrema`: each contour's lowest and highest point, of contours of 3 or more points. */
function computeVerticalExtrema(hints: GlyphHints): void {
  hints.contours.forEach((first, contour) => {
    let min = Infinity;
    let max = -Infinity;
    if (first.next.next !== first) {
      forEachContourPoint(first, (point) => {
        min = Math.min(min, point.y);
        max = Math.max(max, point.y);
      });
    }
    hints.contourYMinima[contour] = min;
    hints.contourYMaxima[contour] = max;
  });
}

function moveContoursUp(hints: GlyphHints, limit: number, delta: number): void {
  hints.contours.forEach((first, contour) => {
    const min = hints.contourYMinima[contour]!;
    if (min < hints.contourYMaxima[contour]! && min > limit) moveContour(first, delta);
  });
}

function moveContoursDown(hints: GlyphHints, limit: number, delta: number): void {
  hints.contours.forEach((first, contour) => {
    const max = hints.contourYMaxima[contour]!;
    if (hints.contourYMinima[contour]! < max && max < limit) moveContour(first, -delta);
  });
}

/** `af_find_highest_contour`: by its top, then by its bottom. */
function highestContour(hints: GlyphHints): number {
  let highest = 0;
  let highestMin = Infinity;
  let highestMax = -Infinity;
  hints.contours.forEach((_, contour) => {
    const min = hints.contourYMinima[contour]!;
    const max = hints.contourYMaxima[contour]!;
    if (max > highestMax || (max === highestMax && min > highestMin))
      [highest, highestMin, highestMax] = [contour, min, max];
  });
  return highest;
}

/** `af_find_lowest_contour`: by its bottom, then by its top. */
function lowestContour(hints: GlyphHints): number {
  let lowest = 0;
  let lowestMin = Infinity;
  let lowestMax = -Infinity;
  hints.contours.forEach((_, contour) => {
    const min = hints.contourYMinima[contour]!;
    const max = hints.contourYMaxima[contour]!;
    if (min < lowestMin || (min === lowestMin && max < lowestMax))
      [lowest, lowestMin, lowestMax] = [contour, min, max];
  });
  return lowest;
}

/** `af_find_second_highest_contour`: the highest of the contours below the highest one's bottom. */
function secondHighestContour(hints: GlyphHints): number {
  if (hints.contours.length < 3) return 0;
  const highest = highestContour(hints);
  const highestMin = hints.contourYMinima[highest]!;
  let second = 0;
  let secondMax = -Infinity;
  hints.contours.forEach((_, contour) => {
    if (contour === highest) return;
    const max = hints.contourYMaxima[contour]!;
    if (max > secondMax && hints.contourYMinima[contour]! < highestMin) [second, secondMax] = [contour, max];
  });
  return second;
}

/** `af_find_second_lowest_contour`: the lowest of the contours above the lowest one's top. */
function secondLowestContour(hints: GlyphHints): number {
  if (hints.contours.length < 3) return 0;
  const lowest = lowestContour(hints);
  const lowestMax = hints.contourYMaxima[lowest]!;
  let second = 0;
  let secondMin = Infinity;
  hints.contours.forEach((_, contour) => {
    if (contour === lowest) return;
    const min = hints.contourYMinima[contour]!;
    if (min < secondMin && hints.contourYMaxima[contour]! > lowestMax) [second, secondMin] = [contour, min];
  });
  return second;
}

/** `af_touch_contour`: the contour's points stay where they are through the rest of the vertical hinting. */
function touchContour(hints: GlyphHints, contour: number): void {
  forEachContourPoint(hints.contours[contour]!, (point) => {
    point.flags |= PointFlag.IGNORE;
    if (!(point.flags & PointFlag.CONTROL)) point.flags |= PointFlag.TOUCH_Y;
  });
}

/** Touches the contours at or above (`isTop`) or at or below the bottom of `limitContour`. */
function touchContoursBeyond(hints: GlyphHints, limitContour: number, isTop: boolean): void {
  const limit = hints.contourYMinima[limitContour]!;
  hints.contours.forEach((_, contour) => {
    const min = hints.contourYMinima[contour]!;
    const max = hints.contourYMaxima[contour]!;
    if (min < max && (isTop ? min >= limit : max <= limit)) touchContour(hints, contour);
  });
}

/**
 * `af_latin_stretch_top_tilde` and `af_latin_stretch_bottom_tilde`: a tilde shorter than its wave
 * plus a pixel stretches to that height away from its base. Returns the growth.
 */
function stretchTilde(hints: GlyphHints, contour: number, isTop: boolean): number {
  const first = hints.contours[contour]!;
  const min = hints.contourYMinima[contour]!;
  const max = hints.contourYMaxima[contour]!;
  if (min === max) return 0;
  const height = heightBetween(max, min);
  const extremumThreshold = divide(height, 8);
  let minMeasurement: number | null = null;
  forEachContourPoint(first, (point) => {
    const measurement = waveDepth(point, min, max);
    if (measurement === null || measurement < extremumThreshold) return;
    if (minMeasurement === null || measurement < minMeasurement) minMeasurement = measurement;
  });
  touchContoursBeyond(hints, contour, isTop);
  const targetHeight = (minMeasurement ?? 0) + 64;
  if (height >= targetHeight) return 0;
  const anchor = isTop ? min : max;
  forEachContourPoint(
    first,
    (point) => (point.y = divide((point.y - anchor) * targetHeight, height) + anchor)
  );
  return targetHeight - height;
}

/** The depth of a tilde's wave at a flat on point between control points, or null for no such point. */
function waveDepth(point: Point, min: number, max: number): number | null {
  const isFlatOnPoint =
    !(point.flags & PointFlag.CONTROL) &&
    point.prev.y === point.y &&
    point.next.y === point.y &&
    point.y !== min &&
    point.y !== max &&
    point.prev.flags & PointFlag.CONTROL &&
    point.next.flags & PointFlag.CONTROL;
  if (!isFlatOnPoint) return null;
  let prevOn = point.prev;
  while (prevOn.flags & PointFlag.CONTROL) prevOn = prevOn.prev;
  let nextOn = point.next;
  while (nextOn.flags & PointFlag.CONTROL) nextOn = nextOn.next;
  if (nextOn.y > point.y && prevOn.y > point.y) return point.y - min;
  if (nextOn.y < point.y && prevOn.y < point.y) return max - point.y;
  return null;
}

/**
 * `af_latin_align_top_tilde` and `af_latin_align_bottom_tilde`: a tilde's bottom, or top, moves
 * onto the pixel grid, and one under 3 px tall centres on its pixels. Returns the move.
 */
function alignTilde(hints: GlyphHints, contour: number, isTop: boolean): number {
  const first = hints.contours[contour]!;
  let min = first.y;
  let max = first.y;
  forEachContourPoint(first, (point) => {
    min = Math.min(min, point.y);
    max = Math.max(max, point.y);
  });
  const height = max - min;
  const centring = height < 64 * 3 ? divide(pixRound(height) - height, 2) : 0;
  const delta = isTop ? pixRound(min) - min + centring : pixRound(max) - max - centring;
  moveContour(first, delta);
  return delta;
}

/** The tilde steps of `af_latin_hints_apply`, before the vertical features. */
export function fitTildes(hints: GlyphHints, flags: number): void {
  if (!(flags & (Adjust.TILDE_TOP | Adjust.TILDE_BOTTOM | Adjust.TILDE_TOP2 | Adjust.TILDE_BOTTOM2))) return;
  computeVerticalExtrema(hints);
  if (flags & Adjust.TILDE_TOP2) {
    const contour = secondHighestContour(hints);
    const offset = stretchTilde(hints, contour, true) + alignTilde(hints, contour, true);
    moveContoursUp(hints, hints.contourYMinima[contour]!, offset);
  }
  if (flags & Adjust.TILDE_BOTTOM2) {
    const contour = secondLowestContour(hints);
    const offset = stretchTilde(hints, contour, false) - alignTilde(hints, contour, false);
    moveContoursDown(hints, hints.contourYMaxima[contour]!, offset);
  }
  if (flags & Adjust.TILDE_TOP) {
    const contour = highestContour(hints);
    stretchTilde(hints, contour, true);
    alignTilde(hints, contour, true);
  }
  if (flags & Adjust.TILDE_BOTTOM) {
    const contour = lowestContour(hints);
    stretchTilde(hints, contour, false);
    alignTilde(hints, contour, false);
  }
}

/** `af_latin_get_base_glyph_blues`: the first active top and bottom zones of capitals or of small letters. */
function baseGlyphBlues(metrics: LatinMetrics, isCapital: boolean): { top?: LatinBlue; bottom?: LatinBlue } {
  const { blues } = metrics.axis[Dimension.VERT];
  const has = (flag: number) => (blue: LatinBlue) =>
    (blue.flags & (flag | LatinBlueFlag.ACTIVE)) === (flag | LatinBlueFlag.ACTIVE);
  return {
    top: blues.find(has(isCapital ? LatinBlueFlag.TOP : LatinBlueFlag.ADJUSTMENT)),
    bottom: blues.find(has(isCapital ? LatinBlueFlag.BOTTOM : LatinBlueFlag.BOTTOM_SMALL)),
  };
}

/** `af_latin_ignore_top` and `af_latin_ignore_bottom`: edges beyond the base glyph's zone, plus a seventh of its height, take no blue. */
function ignoreBlues(hints: GlyphHints, top: LatinBlue, bottom: LatinBlue, isTop: boolean): void {
  const baseHeight = top.shoot.cur - bottom.shoot.cur;
  const limit = isTop
    ? top.shoot.cur + divide(baseHeight, 7) + 16
    : bottom.shoot.cur - divide(baseHeight, 7) - 16;
  for (const edge of hints.axis[Dimension.VERT].edges)
    if (isTop ? edge.pos > limit : edge.pos < limit) edge.flags |= EdgeFlag.NO_BLUE;
}

/** The tallest accent the vertical separation moves: two thirds of the x-height, half the cap height, or 0.4 em. */
function accentHeightLimit(
  metrics: LatinMetrics,
  capital: ReturnType<typeof baseGlyphBlues>,
  small: ReturnType<typeof baseGlyphBlues>
): number {
  if (small.top && small.bottom) return divide(2 * (small.top.shoot.cur - small.bottom.shoot.cur), 3);
  if (capital.top && capital.bottom) return divide(capital.top.shoot.cur - capital.bottom.shoot.cur, 2);
  return ftMulFix(divide(metrics.unitsPerEm * 4, 10), metrics.scaler.yScale);
}

/** The adjustment database's flags for the character of `glyph`, 0 for none. */
export function diacriticFlagsOf(metrics: LatinMetrics, glyph: number): number {
  const codePoint = metrics.reverseCharmap.get(glyph);
  return codePoint === undefined ? 0 : adjustmentFlagsOf(codePoint);
}

/**
 * The diacritic step of `af_latin_hints_apply` after the vertical features: the blue zones of the
 * base glyph that the accent's edges must not take, and the accent's height limit.
 */
export function avoidBaseBlues(hints: GlyphHints, metrics: LatinMetrics, flags: number): DiacriticAdjustment {
  let limit = 0;
  const capital: ReturnType<typeof baseGlyphBlues> = flags ? baseGlyphBlues(metrics, true) : {};
  const small: ReturnType<typeof baseGlyphBlues> = flags ? baseGlyphBlues(metrics, false) : {};
  if (flags && !(flags & Adjust.NO_HEIGHT_CHECK)) limit = accentHeightLimit(metrics, capital, small);
  if (capital.top && capital.bottom) {
    if (flags & Adjust.IGNORE_CAPITAL_TOP) ignoreBlues(hints, capital.top, capital.bottom, true);
    if (flags & Adjust.IGNORE_CAPITAL_BOTTOM) ignoreBlues(hints, capital.top, capital.bottom, false);
  }
  if (small.top && small.bottom) {
    if (flags & Adjust.IGNORE_SMALL_TOP) ignoreBlues(hints, small.top, small.bottom, true);
    if (flags & Adjust.IGNORE_SMALL_BOTTOM) ignoreBlues(hints, small.top, small.bottom, false);
  }
  return { codePointFlags: flags, accentHeightLimit: limit };
}

/** `af_check_contour_horizontal_overlap`: whether the contour overlaps the others horizontally. */
function overlapsOthers(hints: GlyphHints, contourIndex: number): boolean {
  let contourMin = Infinity;
  let contourMax = -Infinity;
  let othersMin = Infinity;
  let othersMax = -Infinity;
  hints.contours.forEach((first, contour) => {
    if (first.next.next === first) return;
    forEachContourPoint(first, ({ x }) => {
      if (contour === contourIndex)
        [contourMin, contourMax] = [Math.min(contourMin, x), Math.max(contourMax, x)];
      else [othersMin, othersMax] = [Math.min(othersMin, x), Math.max(othersMax, x)];
    });
  });
  return (
    (othersMin <= contourMax && contourMax <= othersMax) ||
    (othersMin <= contourMin && contourMin <= othersMax) ||
    (contourMax >= othersMax && contourMin <= othersMin)
  );
}

/** One side of the vertical separation: the accent above the base (`isTop`) or below it. */
interface SeparationSide {
  readonly isTop: boolean;
  /** `AF_ADJUST_UP` or `AF_ADJUST_DOWN`: the accent is the outermost contour. */
  readonly isFirst: boolean;
  /** `AF_ADJUST_UP2` or `AF_ADJUST_DOWN2`: the accent is the next contour in, which wins over the first. */
  readonly isSecond: boolean;
  readonly isTilde: boolean;
  readonly isSecondTilde: boolean;
}

/**
 * Moves the accent on one side a pixel clear of the base, when it overlaps it horizontally and is
 * no taller than the accent height limit. Returns false when the accent fails either test, which
 * ends the separation.
 */
function separate(hints: GlyphHints, side: SeparationSide, heightLimit: number): boolean {
  const { isTop, isFirst, isSecond, isTilde, isSecondTilde } = side;
  const accent = isTop
    ? isSecond
      ? secondHighestContour(hints)
      : highestContour(hints)
    : isSecond
      ? secondLowestContour(hints)
      : lowestContour(hints);
  if (!overlapsOthers(hints, accent)) return false;
  const accentMin = hints.contourYMinima[accent]!;
  const accentMax = hints.contourYMaxima[accent]!;
  const accentHeight = heightBetween(accentMax, accentMin);
  if (accentHeight > heightLimit) return false;
  let minDistance = 64;
  hints.contours.forEach((_, contour) => {
    if (contour === accent) return;
    const min = hints.contourYMinima[contour]!;
    const max = hints.contourYMaxima[contour]!;
    const distance = isTop ? accentMin - max : min - accentMax;
    const isOnBaseSide = isTop ? min < accentMin : max > accentMax;
    if (distance < 64 && distance < minDistance && isOnBaseSide) minDistance = distance;
  });
  const adjustment = 64 - minDistance;
  let centring = 0;
  if (isTilde || isSecondTilde) {
    const tilde = isFirst || isSecondTilde ? accent : isTop ? highestContour(hints) : lowestContour(hints);
    const tildeHeight = heightBetween(hints.contourYMaxima[tilde]!, hints.contourYMinima[tilde]!);
    let pos = isTop ? accentMin + adjustment : accentMax - adjustment;
    if (isSecond && isTilde) pos += isTop ? accentHeight : -accentHeight;
    if (pos % 64 === 0 && tildeHeight < 3 * 64) centring = divide(pixRound(tildeHeight) - tildeHeight, 2);
  }
  const amount = (isFirst && isTilde) || (isSecond && isSecondTilde) ? adjustment + centring : adjustment;
  if (amount === 0 || amount < -2 || (amount > 66 && adjustment > 66)) return true;
  const heightDelta = divide(accentHeight, 8);
  if (isTop) {
    const minLimit = accentMin - heightDelta;
    moveContoursUp(hints, minLimit, adjustment);
    if (isSecond && isTilde) moveContoursUp(hints, minLimit + accentHeight, centring);
  } else {
    const maxLimit = accentMax + heightDelta;
    moveContoursDown(hints, maxLimit, adjustment);
    if (isSecond && isTilde) moveContoursDown(hints, maxLimit - accentHeight, centring);
  }
  return true;
}

/** `af_glyph_hints_apply_vertical_separation_adjustments`, after the vertical axis is hinted. */
export function applyVerticalSeparation(
  hints: GlyphHints,
  { codePointFlags: flags, accentHeightLimit: limit }: DiacriticAdjustment
): void {
  const isAbove = (flags & Adjust.UP) !== 0;
  const isBelowTop = (flags & Adjust.UP2) !== 0;
  const isBelow = (flags & Adjust.DOWN) !== 0;
  const isAboveBottom = (flags & Adjust.DOWN2) !== 0;
  const contourCount = hints.contours.length;
  const doesTop = (isAbove && contourCount >= 2) || (isBelowTop && contourCount >= 3);
  const doesBottom = (isBelow && contourCount >= 2) || (isAboveBottom && contourCount >= 3);
  if (doesTop || doesBottom) computeVerticalExtrema(hints);
  if (doesTop) {
    const side = {
      isTop: true,
      isFirst: isAbove,
      isSecond: isBelowTop,
      isTilde: (flags & Adjust.TILDE_TOP) !== 0,
      isSecondTilde: (flags & Adjust.TILDE_TOP2) !== 0,
    };
    if (!separate(hints, side, limit)) return;
  }
  if (doesBottom) {
    const side = {
      isTop: false,
      isFirst: isBelow,
      isSecond: isAboveBottom,
      isTilde: (flags & Adjust.TILDE_BOTTOM) !== 0,
      isSecondTilde: (flags & Adjust.TILDE_BOTTOM2) !== 0,
    };
    separate(hints, side, limit);
  }
}
