// GENERATED FILE — do not hand-edit.
//
// Produced by `scripts/fonts/bake-metrics.mjs` from
// `packages/textscene-core/assets/fonts/OpenSans_SemiBold.woff2` (Godot
// 4.6.3's default theme font; upstream commit
// bd7e37632246368c60fdcbd374dbf9bad11969b6 — see THIRD-PARTY-NOTICES.md,
// licence OFL-1.1). Re-run the bake script to regenerate; its `--check` mode
// fails if this file has drifted from the vendored font.

/**
 * Font-wide scalar metrics for OpenSans_SemiBold, in font design units
 * (`unitsPerEm` = 2048), read via `fontkit` from the vendored
 * `.woff2` (decompressed in memory at bake time with `wawoff2`, since
 * fontkit does not decompress woff2 itself — see the bake script's header).
 */
interface OpenSansMetrics {
  /** `font.unitsPerEm` (fontkit) — hhea/head design units per em. */
  unitsPerEm: number;
  /** hhea ascender, design units (positive, upward). */
  ascent: number;
  /** hhea descender MAGNITUDE, design units (fontkit reports it negative; stored positive here). */
  descent: number;
  /** hhea lineGap, design units. */
  lineGap: number;
  /**
   * GPOS/kern pairwise advance adjustment, design units, keyed by the
   * two-character pair (e.g. `"AV"`). Empty for OpenSans_SemiBold:
   * this font carries only `mark`/`mkmk` GPOS features, no
   * `kern` feature and no legacy `kern` table. Kept non-optional (rather
   * than omitted) so a synthesized bold/italic, or a different theme font,
   * has somewhere to plug in pairs without a shape change downstream.
   */
  kerning: Record<string, number>;
  /**
   * `post` table `underlinePosition`, design units — the TOP EDGE of the
   * underline stroke relative to the baseline, POSITIVE = above baseline (the
   * `post` table's own Y-up convention; typically negative for a
   * below-baseline underline). Read via `fontkit`'s
   * `TTFFont#underlinePosition` (`fontkit/src/TTFFont.js:192-194`, itself
   * `post.underlinePosition`).
   *
   * This is the RAW table value, NOT FreeType's `face->underline_position`:
   * FreeType re-bases it from that top edge onto the stroke's CENTRE before
   * publishing it (`freetype/src/sfnt/sfobjs.c:1424-1425`), which is the
   * value `text_server_adv.cpp:1517` then scales. `getUnderlinePositionPx`
   * applies that conversion; nothing should read this field without it.
   */
  underlinePosition: number;
  /** `post` table `underlineThickness`, design units — FreeType publishes it unchanged (`sfobjs.c:1426`); scaled by `text_server_adv.cpp:1518`. */
  underlineThickness: number;
  /**
   * OS/2 `xAvgCharWidth`, design units — this font's own "typical glyph
   * width" metric, used ONLY as `textLayout.ts`'s fallback advance for a
   * character the font has no glyph for.
   */
  averageAdvanceUnits: number;
}

export const OPEN_SANS_METRICS: OpenSansMetrics = {"unitsPerEm":2048,"ascent":2189,"descent":600,"lineGap":0,"kerning":{},"underlinePosition":-100,"underlineThickness":50,"averageAdvanceUnits":1214};

/** `OPEN_SANS_METRICS.kerning[a + b] ?? 0` — design-unit advance adjustment for a glyph pair. */
export function getKerningAdjustmentUnits(a: string, b: string): number {
  return OPEN_SANS_METRICS.kerning[a + b] ?? 0;
}

/**
 * Downward pixel offset from a line's baseline to the CENTRE of its underline
 * stroke — Godot's `shaped_text_get_underline_position`, which a stroke
 * drawer (`rich_text_label.cpp:1242-1244`'s `y_off = upos`) adds straight
 * onto the baseline y with no further sign flip.
 *
 * Two conversions sit between the `post` table and that number, and dropping
 * either moves the rule a whole pixel row at UI sizes:
 *
 * 1. `freetype/src/sfnt/sfobjs.c:1424-1425` — FreeType re-bases the table's
 *    TOP-EDGE convention onto the stroke's centre before publishing
 *    `face->underline_position`:
 *    `post.underlinePosition - post.underlineThickness / 2`, an integer
 *    division on `FT_Short`. Half a stroke is only a fraction of a pixel at
 *    a UI size, but the rule is snapped to whole rows downstream, so it is
 *    the fraction that decides which row.
 * 2. `text_server_adv.cpp:1517` — `(-FT_MulFix(face->underline_position,
 *    size->metrics.y_scale) / 64.0) * fd->scale`, a plain proportional scale
 *    (NOT ceiling-rounded like ascent/descent), NEGATED so a below-baseline
 *    (negative) table value becomes a positive DOWNWARD offset.
 *
 * FreeType's own scale quantizes to 26.6 fixed point, which this does not
 * reproduce — the same approximation `getFontAscentPx` already makes, and
 * bounded by 1/64 px (0.016), well under the half-pixel that would move a
 * snapped row at any size.
 *
 * At size 16: -(-100 - 50/2) * 16/2048 = 0.9765625.
 */
export function getUnderlinePositionPx(fontSizePx: number): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  const centreUnits =
    OPEN_SANS_METRICS.underlinePosition - Math.trunc(OPEN_SANS_METRICS.underlineThickness / 2);
  return -centreUnits * scale;
}

/**
 * `text_server_adv.cpp:1518`, scaled the same way as `getUnderlinePositionPx`
 * (no negation — a thickness has no sign to flip). The MINIMUM 1px stroke
 * width (`rich_text_label.cpp:1243`: `MAX(1.0, uth * theme_cache.base_scale)`)
 * is the CALLER's job, not baked in here — `base_scale` is a UI content-scale
 * factor this renderer does not thread through text metrics, and every fixture
 * renders at its default (1.0), where the max is a no-op
 * unless the font's own thickness already exceeds 1px.
 *
 * At size 16: 50 * 16/2048 = 0.390625.
 */
export function getUnderlineThicknessPx(fontSizePx: number): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  return OPEN_SANS_METRICS.underlineThickness * scale;
}
