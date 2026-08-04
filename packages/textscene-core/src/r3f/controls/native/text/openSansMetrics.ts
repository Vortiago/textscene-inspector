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
   * two-character pair (e.g. `"AV"`). Empty for OpenSans_SemiBold's baked
   * charset product — this font carries only `mark`/`mkmk` GPOS features, no
   * `kern` feature and no legacy `kern` table. Kept non-optional (rather
   * than omitted) so a synthesized bold/italic, or a different theme font,
   * has somewhere to plug in pairs without a shape change downstream.
   */
  kerning: Record<string, number>;
  /**
   * `post` table `underlinePosition`, design units — the top of the underline
   * stroke relative to the baseline, POSITIVE = above baseline (the `post`
   * table's own Y-up convention; typically negative for a below-baseline
   * underline). Read via `fontkit`'s `TTFFont#underlinePosition`
   * (`fontkit/src/TTFFont.js:192-194`, itself `post.underlinePosition`),
   * matching FreeType's `face->underline_position` — the same field
   * `text_server_adv.cpp:1517` scales to pixels for `shaped_text_get_underline_position`.
   */
  underlinePosition: number;
  /** `post` table `underlineThickness`, design units — see `underlinePosition`'s doc; scaled by `text_server_adv.cpp:1518`. */
  underlineThickness: number;
  /**
   * OS/2 `xAvgCharWidth`, design units — this font's own "typical glyph
   * width" metric, used ONLY as `textLayout.ts`'s fallback advance for a
   * character outside `OPEN_SANS_ATLAS_GLYPHS` (see that table's own doc in
   * the atlas module). Never mixed into per-glyph advances for a BAKED
   * character — those always come from the atlas's own `xadvance`.
   */
  averageAdvanceUnits: number;
}

export const OPEN_SANS_METRICS: OpenSansMetrics = {"unitsPerEm":2048,"ascent":2189,"descent":600,"lineGap":0,"kerning":{},"underlinePosition":-100,"underlineThickness":50,"averageAdvanceUnits":1214};

/** `OPEN_SANS_METRICS.kerning[a + b] ?? 0` — design-unit advance adjustment for a glyph pair. */
export function getKerningAdjustmentUnits(a: string, b: string): number {
  return OPEN_SANS_METRICS.kerning[a + b] ?? 0;
}

/**
 * `modules/text_server_adv/text_server_adv.cpp:1515-1516` — Godot's
 * TextServerAdvanced reads FreeType's PIXEL-QUANTIZED 26.6 fixed-point size
 * metrics (`face->size->metrics.ascender`), which rounds UP to a whole pixel.
 * Also `rich_text_label.cpp:1049`'s `off.y += l_ascent` (`l_ascent =
 * shaped_text_get_ascent`) — the SAME rounded value is where a line's
 * baseline sits, measured down from the line's own top; every other
 * baseline-relative pixel quantity (the italic shear's pivot, the underline
 * stroke's y) is this plus a further offset, never re-derived.
 *
 * At size 16: ceil(2189 * 16/2048) = 18.
 */
export function getAscentPx(fontSizePx: number): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  return Math.ceil(OPEN_SANS_METRICS.ascent * scale);
}

/**
 * Pixel line pitch at `fontSizePx`, replicating Godot's Label line-height
 * computation exactly rather than a raw float scale of the hhea table:
 *
 * - `modules/text_server_adv/text_server_adv.cpp:1515-1516` — ascent AND
 *   descent are each ceiling-rounded to a whole pixel INDEPENDENTLY before
 *   summing (not a raw float sum, THEN rounded once — that undershoots by
 *   ~1px system-wide, confirmed against real Godot pixels, packet P10 spike
 *   S2).
 * - `scene/theme/default_theme.cpp:392` — Label's `line_spacing` theme
 *   constant is `Math::round(3 * scale)`; `lineSpacingPx` defaults to 3 (UI
 *   scale 1.0).
 *
 * At size 16: 18 + ceil(600 * 16/2048) + 3 = 26.
 */
export function getLinePitchPx(fontSizePx: number, lineSpacingPx = 3): number {
  const ascentPx = getAscentPx(fontSizePx);
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  const descentPx = Math.ceil(OPEN_SANS_METRICS.descent * scale);
  return ascentPx + descentPx + lineSpacingPx;
}

/**
 * `text_server_adv.cpp:1517`: `fd->underline_position = (-FT_MulFix(face->underline_position,
 * size->metrics.y_scale) / 64.0) * fd->scale` — a plain proportional scale of
 * the `post` table value (NOT ceiling-rounded like ascent/descent; FreeType's
 * `y_scale` here is the raw 26.6 size scale, not a hinted metric), NEGATED so
 * a below-baseline `post` value (negative, that table's Y-up convention)
 * becomes a positive DOWNWARD pixel offset from the baseline —
 * `rich_text_label.cpp:1242-1244`'s `y_off = upos` is added directly to the
 * baseline y (`off_step.y`, itself `off.y` after `+= l_ascent`) with no
 * further sign flip.
 *
 * At size 16: -(-100) * 16/2048 = 0.78125.
 */
export function getUnderlinePositionPx(fontSizePx: number): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  return -OPEN_SANS_METRICS.underlinePosition * scale;
}

/**
 * `text_server_adv.cpp:1518`, scaled the same way as `getUnderlinePositionPx`
 * (no negation — a thickness has no sign to flip). The MINIMUM 1px stroke
 * width (`rich_text_label.cpp:1243`: `MAX(1.0, uth * theme_cache.base_scale)`)
 * is the CALLER's job, not baked in here — `base_scale` is a UI content-scale
 * factor this renderer does not thread through text metrics, and every fixture
 * this atlas serves renders at its default (1.0), where the max is a no-op
 * unless the font's own thickness already exceeds 1px.
 *
 * At size 16: 50 * 16/2048 = 0.390625.
 */
export function getUnderlineThicknessPx(fontSizePx: number): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  return OPEN_SANS_METRICS.underlineThickness * scale;
}

/**
 * Fallback advance for a character with no entry in `OPEN_SANS_ATLAS_GLYPHS`
 * (outside the baked charset) — this font's own OS/2 `xAvgCharWidth` scaled,
 * so a missing glyph still occupies roughly its own width rather than
 * collapsing the line to nothing (see `OPEN_SANS_ATLAS_GLYPHS`'s doc in the
 * atlas module and `textLayout.ts`'s `glyphAdvancePx`). This is a deliberate
 * approximation, not a Godot-measured value: real Godot would shape the
 * character against its own system-fallback fonts and draw real ink at that
 * character's real advance, which this renderer cannot do for a codepoint
 * outside the atlas.
 *
 * At size 16: 1214 * 16/2048 = 9.484375.
 */
export function getAverageAdvancePx(fontSizePx: number): number {
  const scale = fontSizePx / OPEN_SANS_METRICS.unitsPerEm;
  return OPEN_SANS_METRICS.averageAdvanceUnits * scale;
}
