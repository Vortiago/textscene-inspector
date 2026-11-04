/**
 * The metrics of a CJK-system style (`afcjk.c`, `afindic.c`): the standard stem widths, as the
 * Latin system finds them, the blue zones of the han style, and their scaling to one size. The
 * Indic styles have no blue zones. FreeType builds without `AF_CONFIG_OPTION_CJK_BLUE_HANI_VERT`,
 * so every han blue zone is on the vertical axis.
 *
 * Portions ported from FreeType (FreeType Project License).
 * Copyright (C) 2006-2026 by David Turner, Robert Wilhelm, and Werner Lemberg.
 * See THIRD-PARTY-NOTICES.md.
 */

import type { ScaledOutline } from '../glyphContours';
import { ftDivFix, ftMulFix, pixRound } from '../fontMetrics';
import { clustersOf, newScaler, shapeStyleCluster, type FaceGlobals, type Scaler } from './afFace';
import { Dimension, divide, newWidth, type DimensionValue } from './afHints';
import type { BlueZone } from './afLatinFeatures';
import {
  initStandardWidths,
  newScaledAxis,
  scaleBlueZones,
  type ScaledAxis,
  type StandardWidthMetrics,
} from './afLatinMetrics';
import { AUTOFIT_STYLES, type BlueString } from './afStyles';

export const CjkBlueFlag = { ACTIVE: 1 << 0, TOP: 1 << 1 } as const;

/** `AF_BLUE_PROPERTY_CJK_TOP`. */
const TOP_PROPERTY = 1 << 0;

export type CjkAxis = ScaledAxis<BlueZone>;

export interface CjkMetrics extends StandardWidthMetrics {
  readonly axis: readonly [CjkAxis, CjkAxis];
}

/** `af_indic_metrics_init`: the standard widths only. */
export function initIndicMetrics(globals: FaceGlobals, styleIndex: number): CjkMetrics {
  const metrics: CjkMetrics = {
    style: AUTOFIT_STYLES[styleIndex]!,
    styleIndex,
    globals,
    scaler: newScaler(),
    unitsPerEm: globals.face.unitsPerEm,
    axis: [newScaledAxis<BlueZone>(), newScaledAxis<BlueZone>()],
  };
  initStandardWidths(metrics);
  return metrics;
}

/** `af_cjk_metrics_init`: the standard widths and the blue zones. */
export function initCjkMetrics(globals: FaceGlobals, styleIndex: number): CjkMetrics {
  const metrics = initIndicMetrics(globals, styleIndex);
  const { blues } = metrics.axis[Dimension.VERT];
  for (const blueString of metrics.style.blues) {
    const blue = blueZoneOf(metrics, blueString);
    if (blue) blues.push(blue);
  }
  return metrics;
}

/** The lowest, or with `isTop` the highest, y of the contours of more than one point, or 0 for none. */
function verticalExtremum(outline: ScaledOutline, isTop: boolean): number {
  let bestPoint = -1;
  let bestY = 0;
  let last = -1;
  for (const end of outline.contourEnds) {
    const first = last + 1;
    last = end;
    if (last <= first) continue;
    for (let point = first; point <= last; point++) {
      const y = outline.y[point]!;
      if (bestPoint < 0 || (isTop ? y > bestY : y < bestY)) [bestPoint, bestY] = [point, y];
    }
  }
  return bestY;
}

/**
 * `af_cjk_metrics_init_blues` for one blue string: the extremum of each glyph, filled before the
 * `|` and flat after it. The zone runs from the median fill to the median flat, or sits at their
 * mean when the flat lies on the wrong side. Null when no glyph of the string loads.
 */
function blueZoneOf(metrics: CjkMetrics, { characters, properties }: BlueString): BlueZone | null {
  const isTop = (properties & TOP_PROPERTY) !== 0;
  const fills: number[] = [];
  const flats: number[] = [];
  let isFill = true;
  for (const cluster of clustersOf(characters)) {
    if (cluster === '|') {
      isFill = false;
      continue;
    }
    const shaped = shapeStyleCluster(metrics, cluster);
    if (shaped.length > 1 || !shaped[0]?.glyph) continue;
    const outline = metrics.globals.face.unscaledGlyph(shaped[0].glyph);
    if (!outline || outline.x.length <= 2) continue;
    (isFill ? fills : flats).push(verticalExtremum(outline, isTop));
  }
  if (fills.length === 0 && flats.length === 0) return null;
  fills.sort((a, b) => a - b);
  flats.sort((a, b) => a - b);
  const fill = fills[fills.length >> 1];
  const flat = flats[flats.length >> 1];
  let ref = fill ?? flat!;
  let shoot = flat ?? fill!;
  if (shoot !== ref && isTop !== shoot < ref) ref = shoot = divide(shoot + ref, 2);
  return { ref: newWidth(ref), shoot: newWidth(shoot), flags: isTop ? CjkBlueFlag.TOP : 0 };
}

/**
 * `af_cjk_metrics_scale_dim`: scales the blue zones of `dim`. A zone of at most 3/4 px is active,
 * its reference on the pixel grid and its overshoot a whole number of pixels from it.
 */
function scaleCjkAxis(axis: CjkAxis, scale: number, delta: number): void {
  if (axis.orgScale === scale && axis.orgDelta === delta) return;
  axis.orgScale = axis.scale = scale;
  axis.orgDelta = axis.delta = delta;
  scaleBlueZones(axis.blues, scale, delta, (blue) => overshootOf(blue, scale));
}

/** The fitted step from the reference to the overshoot: under half a pixel is none. */
function overshootOf(blue: BlueZone, scale: number): number {
  const delta1 = ftDivFix(blue.ref.fit, scale) - blue.shoot.org;
  const scaled = ftMulFix(Math.abs(delta1), scale);
  const delta2 = scaled < 32 ? 0 : pixRound(scaled);
  return delta1 < 0 ? -delta2 : delta2;
}

/** `af_cjk_metrics_scale`. */
export function scaleCjkMetrics(metrics: CjkMetrics, scaler: Scaler): void {
  Object.assign(metrics.scaler, scaler);
  const dims: readonly DimensionValue[] = [Dimension.HORZ, Dimension.VERT];
  for (const dim of dims) {
    const isHorizontal = dim === Dimension.HORZ;
    scaleCjkAxis(
      metrics.axis[dim],
      isHorizontal ? scaler.xScale : scaler.yScale,
      isHorizontal ? scaler.xDelta : scaler.yDelta
    );
  }
}
