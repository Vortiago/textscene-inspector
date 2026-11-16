import { getFontAscentPx, getFontDescentPx, type FontMetrics, type FontSpacing } from './fontMetrics';
import { perObject } from '../../../../utils/perObject';

export const NO_SPACING: FontSpacing = Object.freeze({ top: 0, bottom: 0, space: 0, glyph: 0 });

/** What `FontVariation` hands the text server for its face (`font.cpp:2422-2437`). */
export interface FaceSpacing {
  readonly spacing: FontSpacing;
  readonly baselineOffset: number;
}

export const NO_FACE_SPACING: FaceSpacing = Object.freeze({ spacing: NO_SPACING, baselineOffset: 0 });

function isUnspaced({ spacing, baselineOffset }: FaceSpacing): boolean {
  return (
    baselineOffset === 0 &&
    spacing.top === 0 &&
    spacing.bottom === 0 &&
    spacing.space === 0 &&
    spacing.glyph === 0
  );
}

function spacingKey({ spacing, baselineOffset }: FaceSpacing): string {
  return `${spacing.top},${spacing.bottom},${spacing.space},${spacing.glyph},${baselineOffset}`;
}

export function faceSpacingOf(face: FontMetrics): FaceSpacing {
  return { spacing: face.spacing ?? NO_SPACING, baselineOffset: face.baselineOffset ?? 0 };
}

/** One wrapper per face and spacing, so a layout memoised on the face keeps its hits. */
const spacedFacesOf = perObject((_face: FontMetrics) => new Map<string, FontMetrics>());

/** A variation over a variation takes its own spacing (`font.cpp:3128-3131`). */
export function withSpacing<Metrics extends FontMetrics>(
  metrics: Metrics,
  faceSpacing: FaceSpacing
): Metrics {
  const key = spacingKey(faceSpacing);
  if (spacingKey(faceSpacingOf(metrics)) === key) return metrics;
  const byKey = spacedFacesOf(metrics);
  let spaced = byKey.get(key);
  if (!spaced) {
    spaced = Object.create(metrics, {
      spacing: { value: isUnspaced(faceSpacing) ? undefined : faceSpacing.spacing },
      baselineOffset: { value: faceSpacing.baselineOffset || undefined },
    }) as FontMetrics;
    byKey.set(key, spaced);
  }
  return spaced as Metrics;
}

/** The ascent a glyph of `face` gives its line (`text_server_adv.cpp:5161`). */
export function getFontSpacedAscentPx(face: FontMetrics, fontSizePx: number): number {
  return getFontAscentPx(face, fontSizePx) + (face.spacing?.top ?? 0);
}

/** The descent a glyph of `face` gives its line (`text_server_adv.cpp:5162`). */
export function getFontSpacedDescentPx(face: FontMetrics, fontSizePx: number): number {
  return getFontDescentPx(face, fontSizePx) + (face.spacing?.bottom ?? 0);
}

/** A `float` that nothing rounds (`text_server_adv.cpp:7092-7101`). */
export function getFontBaselineShiftPx(face: FontMetrics, fontSizePx: number): number {
  const baselineOffset = face.baselineOffset ?? 0;
  if (baselineOffset === 0) return 0;
  return Math.fround(
    baselineOffset * (getFontAscentPx(face, fontSizePx) + getFontDescentPx(face, fontSizePx))
  );
}

/** One wrapper per face and height spacing, so a layout memoised on the face keeps its hits. */
const heightSpacedFacesOf = perObject((_face: FontMetrics) => new Map<number, FontMetrics>());

/** `metrics` whose `Font::get_height` adds `heightSpacingPx`. */
export function withHeightSpacing<Metrics extends FontMetrics>(
  metrics: Metrics,
  heightSpacingPx: number
): Metrics {
  if ((metrics.heightSpacingPx ?? 0) === heightSpacingPx) return metrics;
  const byPx = heightSpacedFacesOf(metrics);
  let spaced = byPx.get(heightSpacingPx);
  if (!spaced) {
    spaced = Object.create(metrics, {
      heightSpacingPx: { value: heightSpacingPx || undefined },
    }) as FontMetrics;
    byPx.set(heightSpacingPx, spaced);
  }
  return spaced as Metrics;
}
