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
 *
 * Per-glyph advances are deliberately NOT duplicated here: `openSansAtlas.ts`'s
 * glyph table already carries `xadvance` from the same `hmtx` source, and a
 * second copy would just be a second place for the two to drift apart.
 */
export interface OpenSansMetrics {
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
   * two-character pair (e.g. `"AV"`). Empty for OpenSans_SemiBold's ASCII x
   * ASCII product — this font carries only `mark`/`mkmk` GPOS features, no
   * `kern` feature and no legacy `kern` table. Kept non-optional (rather
   * than omitted) so a synthesized bold/italic, or a different theme font,
   * has somewhere to plug in pairs without a shape change downstream.
   */
  kerning: Record<string, number>;
}

export const OPEN_SANS_METRICS: OpenSansMetrics = {"unitsPerEm":2048,"ascent":2189,"descent":600,"lineGap":0,"kerning":{}};

/** `OPEN_SANS_METRICS.kerning[a + b] ?? 0` — design-unit advance adjustment for a glyph pair. */
export function getKerningAdjustmentUnits(a: string, b: string): number {
  return OPEN_SANS_METRICS.kerning[a + b] ?? 0;
}

/**
 * Pixel line pitch at `fontSizePx`, replicating Godot's Label line-height
 * computation exactly rather than a raw float scale of the hhea table:
 *
 * - `modules/text_server_adv/text_server_adv.cpp:1515-1516` — Godot's
 *   TextServerAdvanced reads FreeType's PIXEL-QUANTIZED 26.6 fixed-point size
 *   metrics (`face->size->metrics.ascender` / `.descender`), which round
 *   each metric UP to a whole pixel independently. Summing raw floats
 *   (ascent+descent as floats, THEN rounding once) undershoots by ~1px
 *   system-wide — confirmed against real Godot pixels (packet P10 spike S2).
 *   So ascent and descent must each be ceiling-rounded to a whole pixel
 *   INDEPENDENTLY, before summing.
 * - `scene/theme/default_theme.cpp:392` — Label's `line_spacing` theme
 *   constant is `Math::round(3 * scale)`; `lineSpacingPx` defaults to 3 (UI
 *   scale 1.0).
 *
 * At size 16: ceil(2189 * 16/2048) + ceil(600 * 16/2048) + 3 = 26.
 */
export function getLinePitchPx(fontSizePx: number, lineSpacingPx = 3): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  const ascentPx = Math.ceil(OPEN_SANS_METRICS.ascent * scale);
  const descentPx = Math.ceil(OPEN_SANS_METRICS.descent * scale);
  return ascentPx + descentPx + lineSpacingPx;
}
