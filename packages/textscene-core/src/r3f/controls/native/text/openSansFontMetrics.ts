/**
 * The vendored Open Sans SemiBold as a `FontMetrics`: the native text engine's default, which a
 * scene with no `Theme` or `font` override shapes against.
 */

// Every field reads through to the GENERATED `openSansMetrics.ts` (`OPEN_SANS_METRICS` and its
// accessors) with getters, not a snapshot, so a live mutation (as `textLayout.test.ts` makes to
// `.kerning`) stays visible.
import type { FontMetrics } from './fontMetrics';
import { OPEN_SANS_METRICS, getGlyphAdvanceUnits, getKerningAdjustmentUnits } from './openSansMetrics';

export const OPEN_SANS_FONT_METRICS: FontMetrics = {
  kind: 'atlas',
  get unitsPerEm() {
    return OPEN_SANS_METRICS.unitsPerEm;
  },
  get ascent() {
    return OPEN_SANS_METRICS.ascent;
  },
  get descent() {
    return OPEN_SANS_METRICS.descent;
  },
  getGlyphAdvanceUnits,
  getKerningAdjustmentUnits,
  get averageAdvanceUnits() {
    return OPEN_SANS_METRICS.averageAdvanceUnits;
  },
};
