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
 * silently reimplement — and drop — the pixel-quantization rules below.
 *
 * There are three such rules, one per quantity, and none of them is a plain
 * float scale of design units: ascent/descent ceil to whole pixels
 * (`getFontAscentPx`, `getFontLinePitchPx`), and a glyph advance goes through
 * FreeType's and HarfBuzz's fixed-point chain to a whole number of 1/64 px
 * (`getFontGlyphAdvancePx`). A fourth — the whole-pixel advance round above
 * `fontUsesSubpixelPositioning`'s threshold — is stateful (it carries a
 * remainder between adjacent glyphs) and therefore lives in the shaper,
 * `textLayout.ts`, with only the size predicate here.
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
 * Which glyph-PAINTING path a `FontMetrics` pairs with — the boundary
 * `textLayout.ts`'s own doc flags as "still open": shaping (this file) is
 * font-agnostic, but the bitmap/rasterisation a placed glyph paints from is
 * NOT, and `TextRun.tsx` needs a way to tell the two painters apart without
 * re-deriving it from which constant happens to be in scope.
 *
 * - `'atlas'` — a pre-baked MSDF atlas (`openSansFontMetrics.ts`, today's
 *   only `'atlas'` implementation). `shapeText`'s `GlyphPlacement.glyph`
 *   lookup only fires for this kind.
 * - `'canvas'` — a runtime-loaded scene font with no atlas
 *   (`runtimeFontMetrics.ts`'s `CanvasFontMetrics`), rasterised through
 *   canvas-2D `FontFace` + `measureText` instead.
 */
export type FontMetricsKind = 'atlas' | 'canvas';

/**
 * Raw, design-unit font metrics a shaper needs. Every px-facing computation
 * below scales through `unitsPerEm` and the target `fontSizePx` — an
 * implementation never does that scaling itself.
 */
export interface FontMetrics {
  /** Which glyph-painting path this metrics object pairs with — see `FontMetricsKind`'s own doc. */
  readonly kind: FontMetricsKind;
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
 *   constant is `Math::round(3 * scale)`. That is LABEL's constant, not a
 *   property of font metrics, so `lineSpacingPx` is required here with no
 *   default: every other text control reads a different key or none at all,
 *   and a default would be Label's 3 silently applied to all of them.
 *
 * At Open Sans SemiBold size 16 with Label's spacing:
 * ceil(2189*16/2048) + ceil(600*16/2048) + 3 = 18 + 5 + 3 = 26.
 */
export function getFontLinePitchPx(
  metrics: Pick<FontMetrics, 'ascent' | 'descent' | 'unitsPerEm'>,
  fontSizePx: number,
  lineSpacingPx: number
): number {
  const ascentPx = getFontAscentPx(metrics, fontSizePx);
  const descentPx = Math.ceil(unitsToPx(metrics.descent, metrics, fontSizePx));
  return ascentPx + descentPx + lineSpacingPx;
}

/** 1.0 in FreeType's 16.16 fixed point (`FT_Fixed`). */
const FIXED_16_16_ONE = 65536;

/**
 * `freetype/include/freetype/fttypes.h`'s `FT_DivFix` (implemented in
 * `freetype/src/base/ftcalc.c`): `a / b` in 16.16, rounded HALF UP on the
 * magnitude (`q = ( ( (FT_UInt64)a << 16 ) + ( b >> 1 ) ) / b`, with the sign
 * re-applied afterwards). Written as a division rather than a shift because
 * the intermediate exceeds 32 bits at every font size this engine uses.
 */
function ftDivFix(a: number, b: number): number {
  const sign = Math.sign(a) * Math.sign(b);
  const magnitude = Math.floor((Math.abs(a) * FIXED_16_16_ONE + Math.floor(Math.abs(b) / 2)) / Math.abs(b));
  return sign * magnitude;
}

/** `freetype/src/base/ftcalc.c`'s `FT_MulFix` — `a * b / 65536`, rounded HALF UP on the magnitude. */
function ftMulFix(a: number, b: number): number {
  const sign = Math.sign(a) * Math.sign(b);
  const magnitude = Math.floor((Math.abs(a) * Math.abs(b) + FIXED_16_16_ONE / 2) / FIXED_16_16_ONE);
  return sign * magnitude;
}

/**
 * The `FT_Size_Request` Godot issues for a font size, reduced to the two
 * numbers everything below needs.
 *
 * `text_server_adv.cpp:1500-1507` requests `FT_SIZE_REQUEST_TYPE_NOMINAL` at
 * `width = height = sz * 64` (26.6) with both resolutions 0, where `sz =
 * fd->size.x / 64.0` (`:1481`) and `fd->size.x` is `_get_size`'s `p_size * 64`
 * (`text_server_adv.h:396-403`) — so Godot's shaping size is always a WHOLE
 * number of pixels: `_shaped_text_add_string`/`_font_get_glyph_advance` take
 * it as `int64_t`, and there is no path that requests a fractional one.
 *
 * `freetype/src/base/ftobjs.c:3257-3258,3295-3320` — NOMINAL divides by
 * `units_per_EM`, and with zero resolution `FT_REQUEST_WIDTH` passes the 26.6
 * request through unscaled, giving `x_scale = FT_DivFix(sz * 64, unitsPerEm)`.
 * `:3350-3361` — `x_ppem = (sz * 64 + 32) >> 6`, i.e. the size rounded to a
 * whole pixel, which is what `text_server_adv.cpp:1509` divides by for
 * `fd->scale`.
 */
function freeTypeSizeRequest(unitsPerEm: number, fontSizePx: number): { xScale: number; ppem: number } {
  // `req.width = sz * 64.0` lands in an `FT_Long`, truncating toward zero.
  const requested26_6 = Math.trunc(fontSizePx * 64);
  return { xScale: ftDivFix(requested26_6, unitsPerEm), ppem: (requested26_6 + 32) >> 6 };
}

/** `servers/text/text_server.h:172` — the largest font size `SUBPIXEL_POSITIONING_AUTO` still positions subpixel-precisely. */
const SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE = 20;

/**
 * Godot's `subpos` (`text_server_adv.cpp:6936`) for a shaping run at
 * `fontSizePx`, against the engine's own default subpixel-positioning mode
 * (`SUBPIXEL_POSITIONING_AUTO` — `text_server_adv.h:343`, and what `FontFile`
 * leaves untouched): true when the size is at or below
 * `SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE` (20 px,
 * `servers/text/text_server.h:172`).
 *
 * FALSE is the branch that matters — `text_server_adv.cpp:7079-7084` then
 * rounds every glyph advance to a WHOLE pixel. A Label at the theme default
 * (16) keeps its fractional advances; the same Label with
 * `theme_override_font_sizes/font_size = 28` does not, and its pen positions
 * are integers.
 *
 * The other `subpos` disjunct, `scale != 1.0`, cannot fire for a whole-pixel
 * size: `fd->scale` is `sz / y_ppem` (`text_server_adv.cpp:1509`) and
 * `freeTypeSizeRequest` rounds `ppem` to exactly that. A caller passing a
 * FRACTIONAL size — which Godot's own `int64_t` size API cannot express —
 * therefore takes the subpixel branch here, matching what a fractional ppem
 * request would produce rather than inventing a whole-pixel round for a size
 * the engine never shapes at.
 */
export function fontUsesSubpixelPositioning(fontSizePx: number): boolean {
  return !Number.isInteger(fontSizePx) || fontSizePx <= SUBPIXEL_POSITIONING_ONE_HALF_MAX_SIZE;
}

/**
 * A character's own advance, target px — `metrics.getGlyphAdvanceUnits(ch)`
 * put through FreeType's and HarfBuzz's own fixed-point chain at
 * `fontSizePx`, or `metrics.averageAdvanceUnits` put through the same chain
 * when the font has no glyph for `ch` (so an unshapeable character still
 * occupies roughly its own width rather than collapsing the line around it —
 * see `textLayout.ts`'s own doc for why a silent zero-width advance is the
 * wrong fallback).
 *
 * This is deliberately NOT the continuous scale `units * (fontSizePx /
 * unitsPerEm)`. Godot's advance is HarfBuzz's `x_advance`
 * (`text_server_adv.cpp:7077`), and by the time HarfBuzz hands it over it has
 * been through two roundings, neither of which the continuous scale has:
 *
 * 1. `freetype/src/base/ftadvanc.c:52` — `FT_MulFix(1024 * advance, x_scale)`
 *    scales the raw `hmtx` value to 16.16, rounding half up.
 * 2. `thirdparty/harfbuzz/src/hb-ft.cc:519,523` — `FT_Get_Advance` (unhinted:
 *    `hb-ft.cc:115` sets `FT_LOAD_DEFAULT | FT_LOAD_NO_HINTING`, which is
 *    also what picks the raw-`hmtx` fast path at `ftadvanc.c:124-131`) then
 *    `(v + (1<<9)) >> 10`, which quantizes to 26.6 — a whole number of 1/64
 *    px — rounding half up again.
 *
 * At `unitsPerEm` 2048 and size 16 that chain reduces to `ceil(units / 2) /
 * 64`, so it differs from the continuous scale by 1/128 px for every glyph
 * with an ODD design-unit advance and by nothing at all for the rest. Small
 * per glyph, but one-sided: it can only ever ADD width, and a string of
 * odd-advance glyphs accumulates enough of it to push a shaped width past a
 * whole pixel that `shapedTextSizeWidthPx`'s ceil then reports a pixel wider.
 */
export function getFontGlyphAdvancePx(metrics: FontMetrics, ch: string, fontSizePx: number): number {
  const units = metrics.getGlyphAdvanceUnits(ch) ?? metrics.averageAdvanceUnits;
  const { xScale } = freeTypeSizeRequest(metrics.unitsPerEm, fontSizePx);
  const advance16_16 = ftMulFix(1024 * units, xScale);
  const advance26_6 = Math.floor((advance16_16 + 512) / 1024);
  return advance26_6 / 64;
}

/** `metrics.getKerningAdjustmentUnits(a, b)` scaled to `fontSizePx`; `0` short-circuits without a scale (no pair, no adjustment). */
export function getFontKerningAdjustmentPx(metrics: FontMetrics, a: string, b: string, fontSizePx: number): number {
  const units = metrics.getKerningAdjustmentUnits(a, b);
  if (units === 0) return 0;
  return unitsToPx(units, metrics, fontSizePx);
}
