/**
 * The vendored Open Sans SemiBold as a `FontMetrics` (`./fontMetrics.ts`) —
 * today's ONLY implementation, and the native text engine's default: a scene
 * that authors no `Theme`/`font` override shapes against exactly this.
 *
 * A thin adapter, not a second bake: every field below reads straight
 * through to the GENERATED `openSansMetrics.ts` (`OPEN_SANS_METRICS` and its
 * existing `getGlyphAdvanceUnits`/`getKerningAdjustmentUnits` accessors,
 * unchanged by this file) — no data is copied or snapshotted anywhere, not
 * even the scalars, which are getters rather than a one-time read of
 * `OPEN_SANS_METRICS` at module-evaluation time. So a live mutation of
 * `OPEN_SANS_METRICS` (as `textLayout.test.ts` does to `.kerning`, to
 * exercise the kerning path) is visible through this object exactly as it
 * was through the un-adapted functions, for every field, not only the two
 * that happen to be function references.
 */
import type { FontMetrics } from './fontMetrics';
import { OPEN_SANS_METRICS, getGlyphAdvanceUnits, getKerningAdjustmentUnits } from './openSansMetrics';

export const OPEN_SANS_FONT_METRICS: FontMetrics = {
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
