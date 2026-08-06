/**
 * The vendored Open Sans SemiBold as a `FontMetrics` (`./fontMetrics.ts`) —
 * today's ONLY implementation, and the native text engine's default: a scene
 * that authors no `Theme`/`font` override shapes against exactly this.
 *
 * A thin adapter, not a second bake: every field below reads straight
 * through to the GENERATED `openSansMetrics.ts` (`OPEN_SANS_METRICS` and its
 * existing `getGlyphAdvanceUnits`/`getKerningAdjustmentUnits` accessors,
 * unchanged by this file) — no data is copied or snapshotted, so a live
 * mutation of `OPEN_SANS_METRICS.kerning` (as `textLayout.test.ts` does to
 * exercise the kerning path) is still visible through this object, exactly
 * as it was through the un-adapted functions.
 */
import type { FontMetrics } from './fontMetrics';
import { OPEN_SANS_METRICS, getGlyphAdvanceUnits, getKerningAdjustmentUnits } from './openSansMetrics';

export const OPEN_SANS_FONT_METRICS: FontMetrics = {
  unitsPerEm: OPEN_SANS_METRICS.unitsPerEm,
  ascent: OPEN_SANS_METRICS.ascent,
  descent: OPEN_SANS_METRICS.descent,
  getGlyphAdvanceUnits,
  getKerningAdjustmentUnits,
  averageAdvanceUnits: OPEN_SANS_METRICS.averageAdvanceUnits,
};
