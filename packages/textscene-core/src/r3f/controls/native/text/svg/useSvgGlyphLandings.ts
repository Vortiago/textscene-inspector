/** The count of SVG glyph bitmaps that have landed for a run's face, which a run's raster keys by. */
import { useSyncExternalStore } from 'react';
import type { FontMetrics } from '../fontMetrics';

const NO_SUBSCRIPTION = (): (() => void) => () => undefined;

/** The landings so far of `fontMetrics`'s SVG glyphs: 0 for a face with none. Each landing renders again. */
export function useSvgGlyphLandings(fontMetrics: FontMetrics): number {
  const svgGlyphs = fontMetrics.outlines?.svgGlyphs;
  return useSyncExternalStore(svgGlyphs?.subscribe ?? NO_SUBSCRIPTION, () => svgGlyphs?.version ?? 0);
}
