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
   * value `text_server_adv.cpp:1517` then scales. `openSansFontMetrics.ts`
   * applies that conversion (`freeTypeUnderlinePosition`).
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
