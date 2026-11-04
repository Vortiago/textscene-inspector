/**
 * The metrics of a Latin-system style (`aflatin.c`): the standard stem widths of each axis, found
 * in the script's standard characters, the blue zones (`afLatinBlues.ts`), and their scaling to one
 * size, which fits the x-height to the pixel grid. Godot reads contours, not advances, so the
 * digit check that keeps digit advances equal is not ported.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 2003-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import { ftMulDiv, ftMulFix, pixFloor, pixRound } from '../fontMetrics';
import {
  clustersOf,
  newScaler,
  shapeStyleCluster,
  type FaceGlobals,
  type Scaler,
  type StyleMetrics,
} from './afFace';
import {
  Dimension,
  divide,
  newGlyphHints,
  newWidth,
  reloadHints,
  sortAndQuantizeWidths,
  type DimensionValue,
  type Width,
} from './afHints';
import { initLatinBlues, type LatinBlue } from './afLatinBlues';
import { computeSegments, LatinBlueFlag, latinConstant, linkSegments } from './afLatinFeatures';
import { reverseCharmapOf, type ReverseCharmap } from './afReverseCharmap';
import { AUTOFIT_SCRIPTS } from './afScripts';
import { AUTOFIT_STYLES } from './afStyles';

/** `AF_LATIN_MAX_WIDTHS` and `AF_CJK_MAX_WIDTHS`: the most standard widths an axis keeps. */
const MAX_WIDTHS = 16;

/** The standard stem widths of an axis, which the Latin and CJK systems find alike. */
export interface StandardWidthAxis {
  widths: Width[];
  edgeDistanceThreshold: number;
  standardWidth: number;
  isExtraLight: boolean;
}

/** A style's metrics whose axes hold standard widths. */
export interface StandardWidthMetrics extends StyleMetrics {
  readonly unitsPerEm: number;
  readonly axis: readonly [StandardWidthAxis, StandardWidthAxis];
}

/** `AF_LatinAxisRec`. Only the vertical axis has blue zones. */
export interface LatinAxis extends StandardWidthAxis {
  scale: number;
  delta: number;
  blues: LatinBlue[];
  /** The scale and delta the axis last scaled from, or null before the first load. */
  orgScale: number | null;
  orgDelta: number;
}

export interface LatinMetrics extends StandardWidthMetrics {
  readonly axis: readonly [LatinAxis, LatinAxis];
  /** Set once the blue zones are found. */
  reverseCharmap: ReverseCharmap;
}

const newLatinAxis = (): LatinAxis => ({
  scale: 0,
  delta: 0,
  widths: [],
  edgeDistanceThreshold: 0,
  standardWidth: 0,
  isExtraLight: false,
  blues: [],
  orgScale: null,
  orgDelta: 0,
});

/** The first glyph of the script's standard characters that shapes to one glyph, or 0 for none. */
function standardGlyph(metrics: StyleMetrics): number {
  for (const cluster of clustersOf(AUTOFIT_SCRIPTS[metrics.style.script]!.standardCharacters)) {
    const shaped = shapeStyleCluster(metrics, cluster);
    if (shaped.length > 1) continue;
    const glyph = shaped[0]?.glyph ?? 0;
    if (glyph) return glyph;
  }
  return 0;
}

/**
 * `af_latin_metrics_init_widths`, and `af_cjk_metrics_init_widths` alike: the distances between the
 * linked segments of the standard glyph on each axis, quantized. An axis with none takes 50 units
 * at 2048 per em as its standard width.
 */
export function initStandardWidths(metrics: StandardWidthMetrics): void {
  const { face } = metrics.globals;
  const glyph = standardGlyph(metrics);
  const outline = glyph ? face.unscaledGlyph(glyph) : null;
  if (outline && outline.x.length > 0) {
    const hints = newGlyphHints(face.unitsPerEm);
    reloadHints(hints, outline);
    for (const dim of [Dimension.HORZ, Dimension.VERT])
      metrics.axis[dim].widths = linkedWidths(hints, dim, metrics.unitsPerEm);
  }
  for (const axis of metrics.axis) {
    const standardWidth =
      axis.widths.length > 0 ? axis.widths[0]!.org : latinConstant(metrics.unitsPerEm, 50);
    axis.edgeDistanceThreshold = divide(standardWidth, 5);
    axis.standardWidth = standardWidth;
    axis.isExtraLight = false;
  }
}

function linkedWidths(
  hints: ReturnType<typeof newGlyphHints>,
  dim: DimensionValue,
  unitsPerEm: number
): Width[] {
  computeSegments(hints, dim);
  linkSegments(hints, dim, []);
  const widths: Width[] = [];
  for (const segment of hints.axis[dim].segments) {
    const { link } = segment;
    if (!link || link.link !== segment || link.index <= segment.index) continue;
    if (widths.length < MAX_WIDTHS) widths.push(newWidth(Math.abs(segment.pos - link.pos)));
  }
  return sortAndQuantizeWidths(widths, divide(unitsPerEm, 100));
}

/**
 * `af_latin_metrics_init`: the metrics of the style, or null when the style finds no blue zone,
 * which hands its glyphs to the dummy style.
 */
export function initLatinMetrics(globals: FaceGlobals, styleIndex: number): LatinMetrics | null {
  const metrics: LatinMetrics = {
    style: AUTOFIT_STYLES[styleIndex]!,
    styleIndex,
    globals,
    scaler: newScaler(),
    unitsPerEm: globals.face.unitsPerEm,
    axis: [newLatinAxis(), newLatinAxis()],
    reverseCharmap: new Map(),
  };
  initStandardWidths(metrics);
  if (!initLatinBlues(metrics)) return null;
  metrics.reverseCharmap = reverseCharmapOf(metrics);
  return metrics;
}

/** The x-height zone grows to the next pixel from this far below it, in 1/64 px. */
const X_HEIGHT_ROUNDING_THRESHOLD = 40;
/** The x-height fit changes the scale only when it moves the tallest point less than 2 px. */
const MAX_X_HEIGHT_FIT_MOVE = 128;

/**
 * The vertical scale that puts the x-height blue on the pixel grid, as `af_latin_metrics_scale_dim`
 * fits it, or `scale` when the fit would move the font's tallest extent 2 px or more.
 */
function xHeightFittedScale(metrics: LatinMetrics, scale: number, dim: DimensionValue): number {
  const { blues } = metrics.axis[Dimension.VERT];
  const blue = blues.find((candidate) => candidate.flags & LatinBlueFlag.ADJUSTMENT);
  if (!blue) return scale;
  const scaled = ftMulFix(blue.shoot.org, scale);
  const fitted = pixFloor(scaled + X_HEIGHT_ROUNDING_THRESHOLD);
  if (scaled === fitted || dim !== Dimension.VERT) return scale;
  const newScale = ftMulDiv(scale, fitted, scaled);
  let maxHeight = metrics.unitsPerEm;
  for (const { ascender, descender } of blues) maxHeight = Math.max(maxHeight, ascender, -descender);
  const move = ftMulFix(maxHeight, newScale - scale);
  return -MAX_X_HEIGHT_FIT_MOVE < move && move < MAX_X_HEIGHT_FIT_MOVE ? newScale : scale;
}

/** `af_latin_metrics_scale_dim`: scales the widths and blue zones of `dim` to `scaler`. */
function scaleLatinAxis(metrics: LatinMetrics, scaler: Scaler, dim: DimensionValue): void {
  const axis = metrics.axis[dim];
  const orgScale = dim === Dimension.HORZ ? scaler.xScale : scaler.yScale;
  const delta = dim === Dimension.HORZ ? scaler.xDelta : scaler.yDelta;
  if (axis.orgScale === orgScale && axis.orgDelta === delta) return;
  axis.orgScale = orgScale;
  axis.orgDelta = delta;
  const scale = xHeightFittedScale(metrics, orgScale, dim);
  axis.scale = scale;
  axis.delta = delta;
  if (dim === Dimension.HORZ) [metrics.scaler.xScale, metrics.scaler.xDelta] = [scale, delta];
  else [metrics.scaler.yScale, metrics.scaler.yDelta] = [scale, delta];
  for (const width of axis.widths) width.cur = width.fit = ftMulFix(width.org, scale);
  axis.isExtraLight = ftMulFix(axis.standardWidth, scale) < 32 + 8;
  if (dim === Dimension.VERT) scaleBlues(axis.blues, scale, delta);
}

/** The step from a blue's reference to its overshoot, snapped to 0, 1/2 or 1 px by its size. */
function snappedOvershoot(dist: number): number {
  const size = Math.abs(dist);
  const snapped = size < 32 ? 0 : size < 48 ? 32 : 64;
  return dist < 0 ? -snapped : snapped;
}

/**
 * Scales each blue zone; one of at most 3/4 px is active, its reference on the pixel grid. A
 * subscript zone that overlaps another active zone turns off.
 */
function scaleBlues(blues: readonly LatinBlue[], scale: number, delta: number): void {
  for (const blue of blues) {
    blue.ref.cur = blue.ref.fit = ftMulFix(blue.ref.org, scale) + delta;
    blue.shoot.cur = blue.shoot.fit = ftMulFix(blue.shoot.org, scale) + delta;
    blue.flags &= ~LatinBlueFlag.ACTIVE;
    const dist = ftMulFix(blue.ref.org - blue.shoot.org, scale);
    if (dist > 48 || dist < -48) continue;
    blue.ref.fit = pixRound(blue.ref.cur);
    blue.shoot.fit = blue.ref.fit - snappedOvershoot(dist);
    blue.flags |= LatinBlueFlag.ACTIVE;
  }
  const isActive = (blue: LatinBlue): boolean => (blue.flags & LatinBlueFlag.ACTIVE) !== 0;
  const isSubTop = (blue: LatinBlue): boolean => (blue.flags & LatinBlueFlag.SUB_TOP) !== 0;
  for (const blue of blues) {
    if (!isSubTop(blue) || !isActive(blue)) continue;
    const overlaps = blues.some(
      (other) =>
        !isSubTop(other) &&
        isActive(other) &&
        other.ref.fit <= blue.shoot.fit &&
        other.shoot.fit >= blue.ref.fit
    );
    if (overlaps) blue.flags &= ~LatinBlueFlag.ACTIVE;
  }
}

/** `af_latin_metrics_scale`: scales both axes to the load's scaler. */
export function scaleLatinMetrics(metrics: LatinMetrics, scaler: Scaler): void {
  metrics.scaler.ppem = scaler.ppem;
  scaleLatinAxis(metrics, scaler, Dimension.HORZ);
  scaleLatinAxis(metrics, scaler, Dimension.VERT);
}
