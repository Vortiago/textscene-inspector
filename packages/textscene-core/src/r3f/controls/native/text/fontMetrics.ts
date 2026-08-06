/**
 * The shaping-side font-metrics contract the native (WebGL) Control text
 * engine shapes against, plus the SHARED px-quantization math every
 * implementation of it goes through — never its own copy.
 *
 * A `FontMetrics` implementation supplies only raw, design-unit data (this
 * font's ascent/descent/unitsPerEm, its own per-glyph advance table, its own
 * kerning pairs, its own average-glyph-width fallback); every function below
 * that turns those raw units into target-pixel quantities lives HERE, once,
 * so a second implementation (a runtime-loaded scene font, rasterised
 * through canvas-2D rather than this repo's baked MSDF atlas) cannot
 * silently reimplement — and drop — the pixel-quantization rule below.
 *
 * `openSansFontMetrics.ts`'s `OPEN_SANS_FONT_METRICS` is the only
 * implementation today (the vendored Open Sans SemiBold, backed by the
 * generated `openSansMetrics.ts`) and is `textLayout.ts`'s default.
 *
 * This module intentionally imports nothing of its own: it is the contract
 * itself, not a font-specific reading of it — a consumer that only needs the
 * TYPE, or only needs to call these functions against ITS OWN metrics
 * object, never pulls Open Sans's baked data into its closure.
 */

/**
 * Raw, design-unit font metrics a shaper needs. Every px-facing computation
 * below scales through `unitsPerEm` and the target `fontSizePx` — an
 * implementation never does that scaling itself.
 */
export interface FontMetrics {
  /** Design units per em (`hhea`/`head` table `unitsPerEm`) — the scale denominator for every raw unit below. */
  readonly unitsPerEm: number;
  /** `hhea` ascender, design units (positive, upward) — FreeType's un-quantized ascent, before the pixel rounding `getFontAscentPx` applies. */
  readonly ascent: number;
  /** `hhea` descender MAGNITUDE, design units (positive) — before the pixel rounding `getFontLinePitchPx` applies. */
  readonly descent: number;
  /** A character's own advance width, design units, or `null` if this font has no glyph for it (a shaper falls back to `averageAdvanceUnits`). */
  getGlyphAdvanceUnits(ch: string): number | null;
  /** Pairwise advance adjustment for two adjacent characters, design units — `0` when the font has no entry for the pair (most fonts, most pairs). */
  getKerningAdjustmentUnits(a: string, b: string): number;
  /** This font's own "typical glyph width" (e.g. OS/2 `xAvgCharWidth`), design units — the fallback advance for a character outside its own charset. */
  readonly averageAdvanceUnits: number;
}

/** `units` scaled from design space to `fontSizePx`, via `metrics.unitsPerEm`. Parenthesized exactly as every call site below needs: `units * (fontSizePx / unitsPerEm)`, not `units * fontSizePx / unitsPerEm` — the two are not bit-identical in general (only coincidentally so at a power-of-two `unitsPerEm`). */
function unitsToPx(units: number, metrics: Pick<FontMetrics, 'unitsPerEm'>, fontSizePx: number): number {
  return units * (fontSizePx / metrics.unitsPerEm);
}

/**
 * `modules/text_server_adv/text_server_adv.cpp:1515-1516` — Godot's
 * TextServerAdvanced reads FreeType's PIXEL-QUANTIZED 26.6 fixed-point size
 * metrics (`face->size->metrics.ascender`), which rounds UP to a whole pixel
 * — never a raw float scale of the font's own design-unit ascent. Also
 * `rich_text_label.cpp:1049`'s `off.y += l_ascent` (`l_ascent =
 * shaped_text_get_ascent`) — the SAME rounded value is where a line's
 * baseline sits, measured down from the line's own top; every other
 * baseline-relative pixel quantity (the italic shear's pivot, the underline
 * stroke's y) is this plus a further offset, never re-derived.
 */
export function getFontAscentPx(metrics: Pick<FontMetrics, 'ascent' | 'unitsPerEm'>, fontSizePx: number): number {
  return Math.ceil(unitsToPx(metrics.ascent, metrics, fontSizePx));
}

/**
 * Pixel line pitch at `fontSizePx`, replicating Godot's Label line-height
 * computation exactly rather than a raw float scale of the font's design
 * units:
 *
 * - `modules/text_server_adv/text_server_adv.cpp:1515-1516` — ascent AND
 *   descent are each ceiling-rounded to a whole pixel INDEPENDENTLY before
 *   summing (not a raw float sum, THEN rounded once — that undershoots by
 *   ~1px system-wide, confirmed against real Godot pixels, packet P10 spike
 *   S2). THIS is the one rule every `FontMetrics` implementation must go
 *   through rather than reimplement: an implementation that computed its own
 *   pitch from a raw float sum of its ascent+descent would silently drop the
 *   quantization and undershoot every line pitch it produces.
 * - `scene/theme/default_theme.cpp:392` — Label's `line_spacing` theme
 *   constant is `Math::round(3 * scale)`; `lineSpacingPx` defaults to 3 (UI
 *   scale 1.0).
 *
 * At Open Sans SemiBold size 16: ceil(2189*16/2048) + ceil(600*16/2048) + 3
 * = 18 + 5 + 3 = 26.
 */
export function getFontLinePitchPx(
  metrics: Pick<FontMetrics, 'ascent' | 'descent' | 'unitsPerEm'>,
  fontSizePx: number,
  lineSpacingPx = 3
): number {
  const ascentPx = getFontAscentPx(metrics, fontSizePx);
  const descentPx = Math.ceil(unitsToPx(metrics.descent, metrics, fontSizePx));
  return ascentPx + descentPx + lineSpacingPx;
}

/**
 * A character's own advance, target px — `metrics.getGlyphAdvanceUnits(ch)`
 * scaled to `fontSizePx`, or `metrics.averageAdvanceUnits` scaled the same
 * way when the font has no glyph for `ch` (so an unshapeable character still
 * occupies roughly its own width rather than collapsing the line around it —
 * see `textLayout.ts`'s own doc for why a silent zero-width advance is the
 * wrong fallback).
 */
export function getFontGlyphAdvancePx(metrics: FontMetrics, ch: string, fontSizePx: number): number {
  const units = metrics.getGlyphAdvanceUnits(ch);
  if (units === null) return unitsToPx(metrics.averageAdvanceUnits, metrics, fontSizePx);
  return unitsToPx(units, metrics, fontSizePx);
}

/** `metrics.getKerningAdjustmentUnits(a, b)` scaled to `fontSizePx`; `0` short-circuits without a scale (no pair, no adjustment). */
export function getFontKerningAdjustmentPx(metrics: FontMetrics, a: string, b: string, fontSizePx: number): number {
  const units = metrics.getKerningAdjustmentUnits(a, b);
  if (units === 0) return 0;
  return unitsToPx(units, metrics, fontSizePx);
}
